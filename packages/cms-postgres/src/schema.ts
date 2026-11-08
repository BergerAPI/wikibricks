import { targetsOf, type Collection, type Collections, type Field, type Fields } from "@wikibricks/cms";
import type postgres from "postgres";
import { columnFields, identifier, itemTablesOf } from "./lists";

export type Queryable = postgres.ISql;

/** A migration of the app's own schema, run once inside the setup transaction */
export type Migration = (sql: Queryable) => Promise<unknown>;

// Any constant works, as long as nothing else takes the same advisory lock
const SETUP_LOCK = 4_242_001;

// Columns the adapter adds itself, and the key that names the kind of a block item
// The views put the fields of a collection next to these columns
const RESERVED_COLLECTION_FIELDS = [
  "version_id",
  "id",
  "type",
  "created_at",
  "version_number",
  "version_created_at",
  "created_by",
  "previous_version",
  "change_message",
  "review_status",
  "reviewed_at",
  "reviewed_by",
  "review_comment",
];
const RESERVED_ITEM_FIELDS = ["id", "version_id", "path", "position", "block"];

/** Name of a collection's table, and the prefix of its array tables */
export const ownerOf = (type: string, collection: Collection<unknown>) => identifier(collection.dbName ?? type);

/** The table of a collection, if it has single values to store */
export const tableOf = (type: string, collection: Collection<unknown>) =>
  columnFields(collection.fields).length > 0 ? ownerOf(type, collection) : undefined;

const columnType = (field: Field<unknown>) => {
  switch (field.type) {
    case "text":
      return field.maxLength ? `VARCHAR(${field.maxLength})` : "TEXT";
    case "select":
      return "TEXT";
    case "number":
      return "INTEGER";
    case "boolean":
      return "BOOLEAN";
    case "date":
      return field.time ? "TIMESTAMPTZ" : "DATE";
    case "relation":
      return "INTEGER REFERENCES entities(id) ON DELETE SET NULL";
    case "external":
      return `INTEGER REFERENCES ${identifier(field.table)}(id) ON DELETE SET NULL`;
    case "array":
    case "blocks":
      throw new Error("Lists have no column");
  }
};

const coreTables = (actorTable?: string) => {
  const actor = actorTable ? `REFERENCES ${identifier(actorTable)}(id) ON DELETE SET NULL` : "";

  return [
    `CREATE TABLE IF NOT EXISTS entities (
      id SERIAL PRIMARY KEY,
      head_version_id INT,
      type VARCHAR(64),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE INDEX IF NOT EXISTS idx_entity ON entities(type, head_version_id)`,
    `CREATE TABLE IF NOT EXISTS entity_versions (
      id SERIAL PRIMARY KEY,
      entity_id INT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
      version_number INT NOT NULL,
      created_at TIMESTAMP DEFAULT NOW(),
      created_by INT ${actor},
      previous_version INT REFERENCES entity_versions(id) ON DELETE SET NULL DEFAULT NULL,
      change_message TEXT DEFAULT '',
      review_status VARCHAR(32) DEFAULT 'pending' CHECK (review_status IN ('pending', 'approved', 'rejected')),
      reviewed_at TIMESTAMP,
      reviewed_by INT ${actor},
      review_comment TEXT DEFAULT ''
    )`,
    `CREATE INDEX IF NOT EXISTS idx_version ON entity_versions(entity_id, version_number, review_status)`,
    // Relations to many entries, placed like the items of lists
    `CREATE TABLE IF NOT EXISTS entity_relations (
      version_id INT NOT NULL REFERENCES entity_versions(id) ON DELETE CASCADE,
      path TEXT NOT NULL,
      position INT NOT NULL,
      target_id INT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
      PRIMARY KEY (version_id, path, position)
    )`,
    `CREATE INDEX IF NOT EXISTS idx_relation_target ON entity_relations(target_id)`,
  ];
};

/**
 * Columns for the single values of some fields, after checking the names and relations of
 * all of them. Columns of new fields are added to existing tables, removed fields keep their
 * column and data.
 */
const columns = (table: string, fields: Fields<unknown>, types: string[], reserved: string[]) => {
  for (const [name, field] of Object.entries(fields)) {
    if (reserved.includes(name)) throw new Error(`${table}.${name} is a reserved name`);

    const unknown = field.type === "relation" && targetsOf(field).find((target) => !types.includes(target));
    if (unknown) throw new Error(`Field ${table}.${name} relates to unknown collection ${unknown}`);
  }

  return columnFields(fields).flatMap(([column, field]) => {
    const statements = [
      `ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS ${identifier(column)} ${columnType(field)}`,
    ];
    if (field.type === "relation")
      statements.push(`CREATE INDEX IF NOT EXISTS ${identifier(`${table}_${column}_idx`)} ON ${table}(${column})`);
    return statements;
  });
};

const VERSION_COLUMNS = `
  v.id AS version_id,
  e.id,
  e.type,
  e.created_at,
  v.version_number,
  v.created_at AS version_created_at,
  v.created_by,
  v.previous_version,
  v.change_message,
  v.review_status,
  v.reviewed_at,
  v.reviewed_by,
  v.review_comment`;

/**
 * The table and views of a collection, and the tables of its list items. The views hold
 * the single values, lists are loaded separately.
 */
const collectionSchema = (type: string, collection: Collection<unknown>, types: string[]) => {
  const table = tableOf(type, collection);
  const statements: string[] = [];

  if (table) {
    statements.push(
      `CREATE TABLE IF NOT EXISTS ${table} (
        version_id INT PRIMARY KEY REFERENCES entity_versions(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,
      ...columns(table, collection.fields, types, RESERVED_COLLECTION_FIELDS),
    );
  }

  for (const [itemTable, fields] of itemTablesOf(ownerOf(type, collection), collection.fields)) {
    statements.push(
      `CREATE TABLE IF NOT EXISTS ${itemTable} (
        id SERIAL PRIMARY KEY,
        version_id INT NOT NULL REFERENCES entity_versions(id) ON DELETE CASCADE,
        path TEXT NOT NULL,
        position INT NOT NULL
      )`,
      `CREATE INDEX IF NOT EXISTS ${identifier(`${itemTable}_version_idx`)} ON ${itemTable}(version_id)`,
      ...columns(itemTable, fields, types, RESERVED_ITEM_FIELDS),
    );
  }

  const viewColumns = [VERSION_COLUMNS, ...columnFields(collection.fields).map(([column]) => `t.${column}`)];
  statements.push(
    `
      CREATE VIEW ${type}_versions_view AS
      SELECT ${viewColumns.join(", ")}
      FROM entity_versions v
      JOIN entities e ON v.entity_id = e.id
      ${table ? `JOIN ${table} t ON t.version_id = v.id` : ""}
      WHERE e.type = '${type}'`,
    `
      CREATE VIEW ${type}_view AS
      SELECT v.* FROM entities e
      JOIN ${type}_versions_view v ON v.version_id = e.head_version_id`,
  );

  return statements;
};

/**
 * Versions of all collections in one view, with the value of each collection's title field as
 * `title`. Listings that mix collections, like the review queue, are read from these.
 */
const combinedViews = (collections: Collections<unknown>) => {
  const selects = Object.entries(collections).map(([type, collection]) => {
    const title = collection.title ? `${identifier(collection.title)}::text` : "NULL::text";
    return `
      SELECT version_id, id, type, ${title} AS title, created_at, version_number, version_created_at,
        created_by, previous_version, change_message, review_status, reviewed_at, reviewed_by, review_comment
      FROM ${type}_versions_view`;
  });

  return [
    `CREATE VIEW cms_versions_view AS ${selects.join(" UNION ALL ")}`,
    `CREATE VIEW cms_entries_view AS
      SELECT v.* FROM entities e
      JOIN cms_versions_view v ON v.version_id = e.head_version_id`,
  ];
};

/**
 * Brings the database up to date: applies pending migrations, then creates the CMS tables
 * and the tables, columns and views of the collections. Runs in one transaction, so a
 * failing migration leaves the database untouched.
 */
export const setUp = async (
  sql: postgres.Sql,
  collections: Collections<unknown>,
  { migrations = {}, actorTable }: { migrations?: Record<string, Migration>; actorTable?: string },
) => {
  const types = Object.keys(collections).map(identifier);
  const statements = [
    ...coreTables(actorTable),
    // Older databases have the same name for the check of the type column
    `ALTER TABLE entities DROP CONSTRAINT IF EXISTS entities_type_check`,
    `ALTER TABLE entities ADD CONSTRAINT entities_type_check CHECK (type IN (${types.map((type) => `'${type}'`).join(", ")}))`,
    // Item tables are shared, so creating them twice is harmless thanks to IF NOT EXISTS
    ...types.flatMap((type) => collectionSchema(type, collections[type], types)),
    ...combinedViews(collections),
  ];

  await sql.begin(async (tx) => {
    // Several instances may start at once, the others wait here until the first is done
    await tx`SELECT pg_advisory_xact_lock(${SETUP_LOCK})`;

    // The views depend on the columns migrations might change, they are rebuilt below
    await tx.unsafe(`DROP VIEW IF EXISTS cms_entries_view, cms_versions_view`);
    for (const type of types) await tx.unsafe(`DROP VIEW IF EXISTS ${type}_view, ${type}_versions_view`);

    await tx`
      CREATE TABLE IF NOT EXISTS migrations (
        name VARCHAR(255) PRIMARY KEY,
        applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    const applied = new Set((await tx<{ name: string }[]>`SELECT name FROM migrations`).map((row) => row.name));

    for (const [name, migrate] of Object.entries(migrations)) {
      if (applied.has(name)) continue;

      console.log(`Applying migration ${name}`);
      await migrate(tx);
      await tx`INSERT INTO migrations (name) VALUES (${name})`;
    }

    for (const statement of statements) await tx.unsafe(statement);
  });
};
