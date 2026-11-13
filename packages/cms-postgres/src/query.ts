import { CmsError, isManyRelation, type Collection, type Condition, type ScalarValue, type Where } from "@wikibricks/cms";
import type postgres from "postgres";
import { columnFields } from "./lists";
import type { Queryable } from "./schema";

type Fragment = postgres.PendingQuery<postgres.Row[]>;

/**
 * The keys a query may use: columns by key, and the relations to many entries, which live in
 * their own table. Every entry has the keys of the combined views, entries of one collection
 * also have its fields.
 */
export const queryKeys = (collection?: Collection<unknown>) => {
  const columns: Record<string, string> = {
    id: "id",
    type: "type",
    createdAt: "created_at",
    updatedAt: "version_created_at",
  };

  if (!collection) return { columns: { ...columns, title: "title" }, relations: [] };

  if (collection.title) columns.title = collection.title;
  for (const [field] of columnFields(collection.fields)) columns[field] = field;
  const relations = Object.entries(collection.fields)
    .filter(([, field]) => isManyRelation(field))
    .map(([name]) => name);

  return { columns, relations };
};

export type QueryKeys = ReturnType<typeof queryKeys>;

const join = (sql: Queryable, parts: Fragment[], operator: "AND" | "OR") =>
  parts.reduce((all, part) => (operator === "AND" ? sql`${all} AND ${part}` : sql`${all} OR ${part}`));

const conditionSql = (sql: Queryable, column: string, condition: Condition, key: string): Fragment => {
  const col = sql(column);

  if (condition === null || typeof condition !== "object") return conditionSql(sql, column, { eq: condition }, key);

  const parts = Object.entries(condition).map(([operator, value]): Fragment => {
    switch (operator) {
      case "eq":
        return value === null ? sql`${col} IS NULL` : sql`${col} = ${value as ScalarValue}`;
      case "ne":
        return value === null ? sql`${col} IS NOT NULL` : sql`${col} IS DISTINCT FROM ${value as ScalarValue}`;
      case "in":
      case "notIn": {
        const values = (value as ScalarValue[]).filter((it) => it !== null) as (string | number | boolean)[];
        if (values.length === 0) return operator === "in" ? sql`FALSE` : sql`TRUE`;
        return operator === "in" ? sql`${col} IN ${sql(values)}` : sql`${col} NOT IN ${sql(values)}`;
      }
      case "contains": {
        const pattern = `%${String(value).replace(/[%_\\]/g, (char) => `\\${char}`)}%`;
        return sql`${col}::text ILIKE ${pattern} ESCAPE '\\'`;
      }
      case "gt":
        return sql`${col} > ${value as string | number}`;
      case "gte":
        return sql`${col} >= ${value as string | number}`;
      case "lt":
        return sql`${col} < ${value as string | number}`;
      case "lte":
        return sql`${col} <= ${value as string | number}`;
      case "exists":
        return value ? sql`${col} IS NOT NULL` : sql`${col} IS NULL`;
      default:
        throw new CmsError("invalid", `${key}.${operator}`);
    }
  });

  return parts.length > 0 ? sql`(${join(sql, parts, "AND")})` : sql`TRUE`;
};

/**
 * A condition on a relation to many entries of the found version, which the query names `v`.
 * Only asks which entries it relates to.
 */
const relationSql = (sql: Queryable, path: string, condition: Condition, key: string): Fragment => {
  const relates = (ids?: ScalarValue[]) => sql`EXISTS (
    SELECT 1 FROM entity_relations r
    WHERE r.version_id = v.version_id AND r.path = ${path}
    ${ids ? sql`AND r.target_id IN ${sql(ids.map(Number))}` : sql``}
  )`;

  if (condition === null) return sql`NOT ${relates()}`;
  if (typeof condition !== "object") return relates([condition]);

  const parts = Object.entries(condition).map(([operator, value]): Fragment => {
    if (operator === "eq") return value === null ? sql`NOT ${relates()}` : relates([value as ScalarValue]);
    if (operator === "in") return (value as ScalarValue[]).length > 0 ? relates(value as ScalarValue[]) : sql`FALSE`;
    if (operator === "exists") return value ? relates() : sql`NOT ${relates()}`;
    throw new CmsError("invalid", `${key}.${operator}`);
  });

  return parts.length > 0 ? sql`(${join(sql, parts, "AND")})` : sql`TRUE`;
};

/** A WHERE condition, only allowing the given keys */
export const whereSql = (sql: Queryable, where: Where, keys: QueryKeys): Fragment => {
  const parts = Object.entries(where).flatMap(([key, condition]): Fragment[] => {
    if (condition === undefined) return [];

    if (key === "and" || key === "or") {
      const nested = (condition as Where[]).map((it) => whereSql(sql, it, keys));
      if (nested.length === 0) return [key === "and" ? sql`TRUE` : sql`FALSE`];
      return [sql`(${join(sql, nested, key === "and" ? "AND" : "OR")})`];
    }

    if (keys.relations.includes(key)) return [relationSql(sql, key, condition as Condition, key)];

    const column = keys.columns[key];
    if (!column) throw new CmsError("invalid", key);
    return [conditionSql(sql, column, condition as Condition, key)];
  });

  return parts.length > 0 ? join(sql, parts, "AND") : sql`TRUE`;
};

/** An ORDER BY list, like "title" or "-updatedAt", with the newest entries first otherwise */
export const orderSql = (sql: Queryable, sort: string | string[] = [], { columns }: QueryKeys) => {
  const keys = (Array.isArray(sort) ? sort : [sort]).filter(Boolean);

  const parts = keys.map((key) => {
    const descending = key.startsWith("-");
    const column = columns[descending ? key.slice(1) : key];
    if (!column) throw new CmsError("invalid", key);
    return descending ? sql`v.${sql(column)} DESC NULLS LAST` : sql`v.${sql(column)} ASC NULLS LAST`;
  });

  // Keeps pages stable when sort values repeat
  parts.push(sql`v.created_at DESC`, sql`v.id DESC`);
  return parts.reduce((all, part) => sql`${all}, ${part}`);
};
