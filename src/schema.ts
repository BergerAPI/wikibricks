import { sql, type Queryable } from "./database";
import {
  entityDefinitions,
  entityTypes,
  inputOf,
  isEntityType,
  type EntityType,
  type FieldDefinition,
} from "./entity-types";
import { migrations } from "./migrations";

// Any constant works, as long as nothing else takes the same advisory lock
const MIGRATION_LOCK = 4_242_001;

// Names from the entity definitions end up in DDL, which can't take parameters
const identifier = (name: string) => {
  if (!/^[a-z_][a-z0-9_]*$/.test(name)) throw new Error(`Invalid name in entity definitions: ${name}`);
  return name;
};

const columnType = (field: FieldDefinition) => {
  switch (inputOf(field).kind) {
    case "number":
      return "INTEGER";
    case "reference":
      return "INTEGER REFERENCES entities(id) ON DELETE SET NULL";
    default:
      return "VARCHAR(255)";
  }
};

const VERSION_COLUMNS = `
  v.id AS version_id,
  e.id,
  e.name,
  e.type,
  e.created_at,
  v.version_number,
  v.created_at AS version_created_at,
  v.created_by,
  v.description,
  v.previous_version,
  v.change_message,
  v.review_status,
  v.reviewed_at,
  v.reviewed_by,
  v.review_comment,
  v.image_id`;

const dropViews = (type: EntityType) =>
  `DROP VIEW IF EXISTS ${identifier(type)}_view, ${type}_versions_view`;

/**
 * The table and views of an entity type, created from its definition.
 * Columns of new fields are added to existing tables. Removed fields keep their column and data.
 */
const entityTypeSchema = (type: EntityType) => {
  const { table, fields } = entityDefinitions[type];
  const statements: string[] = [];

  if (table) {
    identifier(table);
    statements.push(`
      CREATE TABLE IF NOT EXISTS ${table} (
        version_id INT PRIMARY KEY REFERENCES entity_versions(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`);

    for (const [column, field] of Object.entries(fields)) {
      statements.push(
        `ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS ${identifier(column)} ${columnType(field)}`,
      );

      const input = inputOf(field);
      if (input.kind === "reference" && !isEntityType(input.entityType))
        throw new Error(`Field ${type}.${column} references unknown entity type ${input.entityType}`);
      if (input.kind === "reference")
        statements.push(`CREATE INDEX IF NOT EXISTS ${table}_${column}_idx ON ${table}(${column})`);
    }
  } else if (Object.keys(fields).length > 0) {
    throw new Error(`Entity type ${type} has fields but no table`);
  }

  const columns = [VERSION_COLUMNS, ...Object.keys(fields).map((column) => `t.${column}`)];
  statements.push(
    `
      CREATE VIEW ${type}_versions_view AS
      SELECT ${columns.join(", ")}
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

const runMigrations = async (tx: Queryable) => {
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
};

/**
 * Brings the database up to date: applies pending migrations, then creates the
 * tables, columns and views of the entity types. Runs in one transaction, so a
 * failing migration leaves the database untouched.
 */
export const initDatabase = async () => {
  const allowedTypes = entityTypes.map((type) => `'${identifier(type)}'`).join(", ");
  const entityStatements = entityTypes.flatMap(entityTypeSchema);

  await sql.begin(async (tx) => {
    // Several instances may start at once, the others wait here until the first is done
    await tx`SELECT pg_advisory_xact_lock(${MIGRATION_LOCK})`;

    // Entity views depend on the columns migrations might change, they are rebuilt below
    for (const type of entityTypes) await tx.unsafe(dropViews(type));

    await runMigrations(tx);

    // Older databases have the same name for the check of the type column
    await tx.unsafe(`ALTER TABLE entities DROP CONSTRAINT IF EXISTS entities_type_check`);
    await tx.unsafe(
      `ALTER TABLE entities ADD CONSTRAINT entities_type_check CHECK (type IN (${allowedTypes}))`,
    );

    for (const statement of entityStatements) await tx.unsafe(statement);
  });
};
