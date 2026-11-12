import {
  CmsError,
  isListField,
  isSingleValue,
  type AdapterFactory,
  type Collection,
  type Collections,
  type DatabaseAdapter,
  type Entry,
  type FindQuery,
  type Fields,
  type Item,
  type ReviewStatus,
  type Store,
  type TitledVersion,
  type Version,
} from "@wikibricks/cms";
import type postgres from "postgres";
import { columnFields, columnValue, copyField, itemTablesOf, readNested, writeList, writeRelations } from "./lists";
import { orderSql, queryKeys, whereSql } from "./query";
import { ownerOf, setUp, tableOf, type Migration, type Queryable } from "./schema";

export type { Migration, Queryable } from "./schema";

type Fragment = postgres.PendingQuery<postgres.Row[]>;

export type PostgresAdapterOptions = {
  sql: postgres.Sql;
  /** Migrations of the app's own tables, applied once each and in order before the CMS tables are set up */
  migrations?: Record<string, Migration>;
  /** Table that author and reviewer IDs refer to, like "users". Without it, IDs are stored as they are. */
  actorTable?: string;
};

// Rows of the version views, with the field columns of a collection or a title on top
type VersionRow = {
  version_id: number;
  id: number;
  type: string;
  created_at: Date;
  version_number: number;
  version_created_at: Date;
  created_by: number | null;
  previous_version: number | null;
  change_message: string;
  review_status: ReviewStatus;
  reviewed_at: Date | null;
  reviewed_by: number | null;
  review_comment: string;
  [column: string]: unknown;
};

const toVersion = (row: VersionRow): Version => ({
  versionId: row.version_id,
  entityId: row.id,
  versionNumber: row.version_number,
  status: row.review_status,
  authorId: row.created_by,
  previousVersionId: row.previous_version,
  changeMessage: row.change_message,
  reviewerId: row.reviewed_by,
  reviewComment: row.review_comment,
  reviewedAt: row.reviewed_at,
  createdAt: row.version_created_at,
});

const toTitledVersion = (row: VersionRow): TitledVersion => ({
  ...toVersion(row),
  type: row.type,
  title: (row.title as string | null) ?? null,
});

const createStore = (
  db: Queryable,
  collections: Collections<unknown>,
): Store & { toEntry(row: VersionRow, collection: Collection<unknown>): Promise<Entry> } => {
  // Lists are not part of the views and are loaded separately
  const toEntry = async (row: VersionRow, collection: Collection<unknown>): Promise<Entry> => ({
    ...toVersion(row),
    type: row.type,
    title: collection.title ? ((row[collection.title] as string | null) ?? null) : null,
    entityCreatedAt: row.created_at,
    values: {
      ...Object.fromEntries(columnFields(collection.fields).map(([name, field]) => [name, columnValue(field, row[name])])),
      ...(await readNested(db, ownerOf(row.type, collection), collection.fields, row.version_id)),
    },
  });

  return {
    toEntry,

    async getEntry(entityId, versionId) {
      const [info] = await db<{ type: string }[]>`SELECT type FROM entities WHERE id = ${entityId}`;
      const collection = info && collections[info.type];
      if (!collection) return;

      // Every collection has a view for its current version and one for all versions
      const [row] = await (versionId === undefined
        ? db<VersionRow[]>`SELECT * FROM ${db(`${info.type}_view`)} WHERE id = ${entityId}`
        : db<VersionRow[]>`
            SELECT * FROM ${db(`${info.type}_versions_view`)}
            WHERE id = ${entityId} AND version_id = ${versionId}
          `);
      return row && toEntry(row, collection);
    },

    async lockEntity(entityId) {
      const [entity] = await db<{ type: string; head_version_id: number | null; latest_version_id: number }[]>`
        SELECT type, head_version_id,
          (SELECT MAX(id) FROM entity_versions WHERE entity_id = e.id) AS latest_version_id
        FROM entities e WHERE id = ${entityId} FOR NO KEY UPDATE
      `;
      return (
        entity && {
          type: entity.type,
          headVersionId: entity.head_version_id,
          latestVersionId: entity.latest_version_id,
        }
      );
    },

    async lock(key) {
      await db`SELECT pg_advisory_xact_lock(hashtext(${key}))`;
    },

    async entityType(entityId) {
      const [entity] = await db<{ type: string }[]>`SELECT type FROM entities WHERE id = ${entityId}`;
      return entity?.type;
    },

    async firstEntityId(type) {
      const [entity] = await db<{ id: number }[]>`SELECT id FROM entities WHERE type = ${type} ORDER BY id LIMIT 1`;
      return entity?.id;
    },

    async isTaken(type, field, value, exceptEntityId) {
      const table = ownerOf(type, collections[type]);
      const [row] = await db`
        SELECT 1 FROM ${db(table)} t
        JOIN entity_versions v ON v.id = t.version_id
        JOIN entities e ON e.id = v.entity_id
        WHERE e.type = ${type} AND t.${db(field)} = ${value}
          AND e.id <> ${exceptEntityId ?? 0}
          AND (v.id = e.head_version_id OR e.head_version_id IS NULL)
        LIMIT 1
      `;
      return !!row;
    },

    async insertEntity(type) {
      const [{ id }] = await db<{ id: number }[]>`INSERT INTO entities (type) VALUES (${type}) RETURNING id`;
      return id;
    },

    async insertVersion(type, version) {
      const [{ id }] = await db<{ id: number }[]>`
        INSERT INTO entity_versions ${db({
          entity_id: version.entityId,
          version_number: version.versionNumber,
          created_by: version.authorId,
          previous_version: version.previousVersionId,
          change_message: version.changeMessage,
          review_status: "pending",
        })}
        RETURNING id
      `;

      const collection = collections[type];
      const table = tableOf(type, collection);
      if (table) {
        // Copy every column of the previous version, including ones that no longer have a field
        const [previous] = version.previousVersionId
          ? await db<Record<string, unknown>[]>`
              SELECT * FROM ${db(table)} WHERE version_id = ${version.previousVersionId}
            `
          : [];
        const { version_id: _, created_at: __, ...columns } = previous ?? {};
        const changed = Object.fromEntries(
          columnFields(collection.fields)
            .filter(([field]) => field in version.values)
            .map(([field]) => [field, version.values[field]]),
        );

        await db`INSERT INTO ${db(table)} ${db({ ...columns, ...changed, version_id: id })}`;
      }

      // Lists and relations to many entries are given as a whole, the ones left out are carried over
      const owner = ownerOf(type, collection);
      for (const [name, field] of Object.entries(collection.fields)) {
        if (isSingleValue(field)) continue;

        const value = version.values[name];
        if (value === undefined) {
          if (version.previousVersionId) await copyField(db, version.previousVersionId, id, owner, name, field);
        } else if (isListField(field)) {
          await writeList(db, id, owner, name, field, value as Item[]);
        } else {
          await writeRelations(db, id, name, value as number[]);
        }
      }

      return id;
    },

    async nextVersionNumber(entityId) {
      const [{ next }] = await db<{ next: number }[]>`
        SELECT COALESCE(MAX(version_number), 0) + 1 AS next FROM entity_versions WHERE entity_id = ${entityId}
      `;
      return next;
    },

    async setReview(entityId, versionId, { status, reviewerId, comment }) {
      const [reviewed] = await db`
        UPDATE entity_versions
        SET review_status = ${status}, reviewed_at = NOW(), reviewed_by = ${reviewerId}, review_comment = ${comment}
        WHERE id = ${versionId} AND entity_id = ${entityId} AND review_status = 'pending'
        RETURNING id
      `;
      return !!reviewed;
    },

    async setHead(entityId, versionId) {
      await db`UPDATE entities SET head_version_id = ${versionId} WHERE id = ${entityId}`;
    },

    async pruneVersions(entityId) {
      await db`
        DELETE FROM entity_versions
        WHERE entity_id = ${entityId} AND review_status <> 'pending'
          AND id <> (SELECT head_version_id FROM entities WHERE id = ${entityId})
      `;
    },

    async deleteEntity(entityId) {
      await db`DELETE FROM entities WHERE id = ${entityId}`;
    },
  };
};

// Tables holding single values: those of the collections, and those of list items
const valueTables = (collections: Collections<unknown>) => {
  const collectionTables = new Map<string, Fields<unknown>>();
  const itemTables = new Map<string, Fields<unknown>>();

  for (const [type, collection] of Object.entries(collections)) {
    const table = tableOf(type, collection);
    if (table) collectionTables.set(table, collection.fields);
    itemTablesOf(ownerOf(type, collection), collection.fields, itemTables);
  }
  return { collectionTables, itemTables };
};

/**
 * Stores collections in PostgreSQL: an entities and an entity_versions table shared by all
 * collections, a table per collection with a column per field, tables for the items of
 * lists, and two views per collection plus two for all of them.
 */
export const postgresAdapter =
  ({ sql, migrations, actorTable }: PostgresAdapterOptions): AdapterFactory =>
  (collections): DatabaseAdapter => {
    const store = createStore(sql, collections);

    const currentQuery = ({ type, where = {}, sort, limit, offset = 0 }: FindQuery) => {
      const collection = type === undefined ? undefined : collections[type];
      if (type !== undefined && !collection) throw new CmsError("invalid", "type");

      const keys = queryKeys(collection);
      const view = sql(type === undefined ? "cms_entries_view" : `${type}_view`);
      const from = sql`FROM ${view} v WHERE ${whereSql(sql, where, keys)}`;
      const page = sql`${from} ORDER BY ${orderSql(sql, sort, keys)}
        ${limit === undefined ? sql`` : sql`LIMIT ${limit}`} OFFSET ${offset}`;
      return { collection, from, page };
    };

    return {
      ...store,

      init: () => setUp(sql, collections, { migrations, actorTable }),

      transaction: (run) => sql.begin((tx) => run(createStore(tx, collections))) as ReturnType<typeof run>,

      async find(query) {
        const { collection, from, page } = currentQuery(query);
        const [[{ count }], rows] = await Promise.all([
          sql<{ count: string }[]>`SELECT COUNT(*) AS count ${from}`,
          sql<VersionRow[]>`SELECT * ${page}`,
        ]);

        // Rows of the combined view only have the shared columns, so their entries are loaded one by one
        const items = await Promise.all(
          rows.map((row) => (collection ? store.toEntry(row, collection) : store.getEntry(row.id))),
        );
        return { total: Number(count), items: items.filter((item) => item !== undefined) };
      },

      async list(query) {
        const { collection, page } = currentQuery(query);
        const titleColumn = collection ? collection.title : "title";
        const title = titleColumn ? sql`v.${sql(titleColumn)}::text` : sql`NULL::text`;
        const rows = await sql<{ id: number; type: string; title: string | null; created_at: Date }[]>`
          SELECT v.id, v.type, ${title} AS title, v.created_at ${page}
        `;
        return rows.map((row) => ({ entityId: row.id, type: row.type, title: row.title, entityCreatedAt: row.created_at }));
      },

      async history(entityId, limit) {
        const [[entity], rows] = await Promise.all([
          sql<{ head_version_id: number | null }[]>`SELECT head_version_id FROM entities WHERE id = ${entityId}`,
          sql<VersionRow[]>`
            SELECT * FROM cms_versions_view WHERE id = ${entityId}
            ORDER BY version_number DESC, version_id DESC
            LIMIT ${limit}
          `,
        ]);
        if (!entity) return;

        const current = rows.find((row) => row.version_id === entity.head_version_id) ?? rows[0];
        return { title: (current?.title as string | null) ?? null, versions: rows.map(toVersion) };
      },

      async pending(limit, { offset = 0, oldestFirst = false } = {}) {
        const direction = oldestFirst ? sql`ASC` : sql`DESC`;
        const rows = await sql<VersionRow[]>`
          SELECT * FROM cms_versions_view WHERE review_status = 'pending'
          ORDER BY version_created_at ${direction}, version_id ${direction}
          LIMIT ${limit} OFFSET ${offset}
        `;
        return rows.map(toTitledVersion);
      },

      async countPending() {
        const [{ count }] = await sql<{ count: string }[]>`
          SELECT COUNT(*) AS count FROM entity_versions WHERE review_status = 'pending'
        `;
        return Number(count);
      },

      async activity(authorId, limit) {
        const rows = await sql<VersionRow[]>`
          SELECT * FROM cms_versions_view WHERE created_by = ${authorId}
          ORDER BY version_created_at DESC
          LIMIT ${limit}
        `;
        return rows.map(toTitledVersion);
      },

      async referencing(entityId, limit) {
        const { itemTables } = valueTables(collections);
        const sources: Fragment[] = [];

        for (const [type, collection] of Object.entries(collections)) {
          const title = collection.title ? sql`v.${sql(collection.title)}::text` : sql`NULL::text`;
          for (const [column, field] of columnFields(collection.fields)) {
            if (field.type !== "relation") continue;
            sources.push(sql`
              SELECT v.id, v.type, ${title} AS title, ${column}::text AS field
              FROM ${sql(`${type}_view`)} v
              WHERE v.${sql(column)} = ${entityId}
            `);
          }
        }

        // Relations inside lists count for the list field holding them
        for (const [table, fields] of itemTables) {
          for (const [column, field] of columnFields(fields)) {
            if (field.type !== "relation") continue;
            sources.push(sql`
              SELECT v.id, v.type, v.title, split_part(i.path, '.', 1) AS field
              FROM cms_entries_view v JOIN ${sql(table)} i ON i.version_id = v.version_id
              WHERE i.${sql(column)} = ${entityId}
            `);
          }
        }

        sources.push(sql`
          SELECT v.id, v.type, v.title, split_part(r.path, '.', 1) AS field
          FROM cms_entries_view v JOIN entity_relations r ON r.version_id = v.version_id
          WHERE r.target_id = ${entityId}
        `);

        const references = sources.reduce((all, source) => sql`${all} UNION ${source}`);
        const rows = await sql<{ id: number; type: string; title: string | null; field: string }[]>`
          SELECT * FROM (${references}) refs ORDER BY type, title, id LIMIT ${limit}
        `;
        return rows.map((row) => ({ entityId: row.id, type: row.type, title: row.title, field: row.field }));
      },

      async isReferenced(table, id) {
        const { collectionTables, itemTables } = valueTables(collections);

        for (const [owner, fields] of [...collectionTables, ...itemTables]) {
          for (const [column, field] of columnFields(fields)) {
            if (field.type !== "external" || field.table !== table) continue;

            const [row] = await sql`SELECT 1 FROM ${sql(owner)} WHERE ${sql(column)} = ${id} LIMIT 1`;
            if (row) return true;
          }
        }
        return false;
      },
    };
  };
