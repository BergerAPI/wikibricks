import {
  isListField,
  isManyRelation,
  isSingleValue,
  type Field,
  type Fields,
  type Item,
  type ScalarValue,
  type Values,
} from "@wikibricks/cms";
import type { Queryable } from "./schema";

/**
 * Items of array and blocks fields live in their own tables: one per block kind, shared by
 * every field using the block, and one per array field. Relations to many entries live in
 * the entity_relations table. Each row belongs to a version and is placed by its path, like
 * "sections" or "sections.2.columns" for a list inside the third item of "sections", and its
 * position in that list. Paths use positions instead of row IDs, so a list is carried over
 * to a new version by copying its rows as they are.
 */

/** Names in DDL can't be parameters, and Postgres cuts identifiers after 63 characters */
export const identifier = (name: string) => {
  if (!/^[a-z_][a-z0-9_]*$/.test(name) || name.length > 63)
    throw new Error(`Invalid name in collections: ${name}`);
  return name;
};

/** One kind of item a list field can hold, and the table it is stored in */
type ItemKind = { slug?: string; table: string; fields: Fields<unknown> };

/**
 * The kinds of items of a list field. `owner` is the table name of what the field belongs
 * to, which array tables are named after.
 */
export const kindsOf = (owner: string, name: string, field: Field<unknown>): ItemKind[] => {
  if (field.type === "blocks")
    return field.blocks.map((block) => ({
      slug: block.slug,
      table: identifier(block.dbName ?? `block_${block.slug}`),
      fields: block.fields,
    }));
  if (field.type === "array") return [{ table: identifier(`${owner}_${name}`), fields: field.fields }];
  return [];
};

/** All item tables reachable from some fields, with the fields each one stores */
export const itemTablesOf = (owner: string, fields: Fields<unknown>, found = new Map<string, Fields<unknown>>()) => {
  for (const [name, field] of Object.entries(fields)) {
    for (const kind of kindsOf(owner, name, field)) {
      // Blocks may contain themselves, so every table is only followed once
      if (found.has(kind.table)) continue;
      found.set(kind.table, kind.fields);
      itemTablesOf(kind.table, kind.fields, found);
    }
  }
  return found;
};

/** A stored value as the CMS hands it out: dates as strings, like they are submitted */
export const columnValue = (field: Field<unknown>, value: unknown): ScalarValue => {
  if (value === undefined || value === null) return null;
  if (field.type === "date" && value instanceof Date)
    return field.time ? value.toISOString() : value.toISOString().slice(0, 10);
  return value as ScalarValue;
};

/** The fields stored in a column of their table */
export const columnFields = (fields: Fields<unknown>) =>
  Object.entries(fields).filter(([, field]) => isSingleValue(field));

type ItemRow = { id: number; version_id: number; path: string; position: number; [column: string]: unknown };
type RelationRow = { path: string; position: number; target_id: number };

/**
 * Loads the fields of a version that aren't stored in columns: lists, with everything
 * nested in them, and relations to many entries.
 */
export const readNested = async (db: Queryable, owner: string, fields: Fields<unknown>, versionId: number) => {
  const tables = itemTablesOf(owner, fields);
  const hasRelations = [fields, ...tables.values()].some((it) => Object.values(it).some(isManyRelation));
  if (tables.size === 0 && !hasRelations) return {};

  // Rows of every table, grouped by the list they belong to
  const lists = new Map<string, (ItemRow & { table: string })[]>();
  for (const table of tables.keys()) {
    for (const row of await db<ItemRow[]>`SELECT * FROM ${db(table)} WHERE version_id = ${versionId}`) {
      lists.set(row.path, [...(lists.get(row.path) ?? []), { ...row, table }]);
    }
  }

  const relations = new Map<string, number[]>();
  if (hasRelations) {
    const rows = await db<RelationRow[]>`
      SELECT path, position, target_id FROM entity_relations WHERE version_id = ${versionId}
      ORDER BY position
    `;
    for (const row of rows) relations.set(row.path, [...(relations.get(row.path) ?? []), row.target_id]);
  }

  const build = (owner: string, fields: Fields<unknown>, path?: string, row?: ItemRow) => {
    const values: Values = {};

    // Same order as the definition, so items compare equal to submitted ones
    for (const [name, field] of Object.entries(fields)) {
      const fieldPath = path ? `${path}.${name}` : name;

      if (isManyRelation(field)) {
        values[name] = relations.get(fieldPath) ?? [];
        continue;
      }
      if (!isListField(field)) {
        values[name] = columnValue(field, row?.[name]);
        continue;
      }

      const kinds = kindsOf(owner, name, field);
      values[name] = (lists.get(fieldPath) ?? [])
        .sort((a, b) => a.position - b.position)
        .flatMap((item) => {
          const kind = kinds.find((it) => it.table === item.table);
          if (!kind) return [];

          const itemValues = build(kind.table, kind.fields, `${fieldPath}.${item.position}`, item);
          return [kind.slug ? { block: kind.slug, ...itemValues } : itemValues] as Item[];
        });
    }
    return values;
  };

  return Object.fromEntries(Object.entries(build(owner, fields)).filter(([name]) => !isSingleValue(fields[name])));
};

export const writeRelations = async (db: Queryable, versionId: number, path: string, ids: number[]) => {
  if (ids.length === 0) return;
  const rows = ids.map((target_id, position) => ({ version_id: versionId, path, position, target_id }));
  await db`INSERT INTO entity_relations ${db(rows)}`;
};

/**
 * Stores the items of a list field for a version, with everything nested in them.
 */
export const writeList = async (
  db: Queryable,
  versionId: number,
  owner: string,
  name: string,
  field: Field<unknown>,
  items: Item[],
  path = name,
) => {
  const kinds = kindsOf(owner, name, field);

  for (const [position, item] of items.entries()) {
    const kind = field.type === "blocks" ? kinds.find((it) => it.slug === item.block) : kinds[0];
    if (!kind) throw new Error(`Unknown item in ${path}`);

    const columns = Object.fromEntries(columnFields(kind.fields).map(([column]) => [column, item[column] ?? null]));
    await db`INSERT INTO ${db(kind.table)} ${db({ ...columns, version_id: versionId, path, position })}`;

    for (const [sub, subField] of Object.entries(kind.fields)) {
      const subPath = `${path}.${position}.${sub}`;
      if (isListField(subField))
        await writeList(db, versionId, kind.table, sub, subField, (item[sub] ?? []) as Item[], subPath);
      if (isManyRelation(subField)) await writeRelations(db, versionId, subPath, (item[sub] ?? []) as number[]);
    }
  }
};

/**
 * Copies a field that isn't stored in a column from one version to another: the items of a
 * list with everything nested in them, or the entries a relation points to.
 */
export const copyField = async (
  db: Queryable,
  fromVersionId: number,
  toVersionId: number,
  owner: string,
  name: string,
  field: Field<unknown>,
) => {
  const tables = [...itemTablesOf(owner, { [name]: field }).keys(), "entity_relations"];

  for (const table of tables) {
    const rows = await db<Record<string, unknown>[]>`
      SELECT * FROM ${db(table)}
      WHERE version_id = ${fromVersionId} AND (path = ${name} OR starts_with(path, ${`${name}.`}))
    `;
    if (rows.length === 0) continue;

    const copies = rows.map(({ id: _, ...row }) => ({ ...row, version_id: toVersionId }));
    await db`INSERT INTO ${db(table)} ${db(copies)}`;
  }
};
