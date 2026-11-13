import type { Store } from "./adapter";
import { CmsError } from "./errors";
import {
  isListField,
  isManyRelation,
  isSingleValue,
  targetsOf,
  type Field,
  type FieldValue,
  type Fields,
  type Item,
  type ScalarValue,
  type Values,
} from "./types";

/** An integer within the range used by the storage adapter. */
export const parseInteger = (value: unknown) => {
  if (typeof value !== "number" && (typeof value !== "string" || !value.trim())) return;
  const number = Number(value);
  return Number.isInteger(number) && number >= -2_147_483_648 && number <= 2_147_483_647 ? number : undefined;
};

/** IDs are positive integers. Text IDs use decimal digits. */
export const parseId = (value: unknown) => {
  if (typeof value === "string" && !/^\d+$/.test(value)) return;
  const id = parseInteger(value);
  return id !== undefined && id > 0 ? id : undefined;
};

// Days stay as written, moments are stored in UTC
const parseDate = (value: unknown, time: boolean) => {
  if (typeof value !== "string" && !(value instanceof Date)) return;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return;
  if (time) return date.toISOString();

  const day = value instanceof Date ? date.toISOString().slice(0, 10) : value;
  return /^\d{4}-\d{2}-\d{2}$/.test(day) && date.toISOString().startsWith(day) ? day : undefined;
};

// An ID of an entry in one of the collections the relation may point to
const parseRelation = async (field: { to: string | readonly string[] }, value: unknown, store: Store) => {
  const id = parseId(value);
  const type = id && (await store.entityType(id));
  return type && targetsOf(field).includes(type) ? id : undefined;
};

const parseRelations = async (
  field: { to: string | readonly string[] },
  value: unknown,
  path: string,
  store: Store,
) => {
  if (!Array.isArray(value)) throw new CmsError("invalid", path);

  const ids: number[] = [];
  for (const [position, item] of value.entries()) {
    const id = await parseRelation(field, item, store);
    if (!id) throw new CmsError("invalid", `${path}.${position}`);
    if (!ids.includes(id)) ids.push(id);
  }
  return ids;
};

const parseScalar = async (field: Field<unknown>, value: unknown, store: Store) => {
  if (field.type === "boolean") {
    if (typeof value === "boolean") return value;
    return value === "true" ? true : value === "false" ? false : undefined;
  }

  if (field.type === "date") return parseDate(value, !!field.time);

  if (typeof value !== "string" && typeof value !== "number") return;

  switch (field.type) {
    case "text":
      if (typeof value !== "string" || (field.maxLength && value.length > field.maxLength)) return;
      return value;

    case "number":
      return parseInteger(value);

    case "select":
      return field.options.includes(String(value)) ? String(value) : undefined;

    case "relation":
      return parseRelation(field, value, store);

    case "external":
      return parseId(value);
  }
};

const parseList = async (field: Field<unknown>, value: unknown, path: string, store: Store) => {
  if (!Array.isArray(value)) throw new CmsError("invalid", path);

  const items: Item[] = [];
  for (const [position, item] of value.entries()) {
    const itemPath = `${path}.${position}`;
    if (!item || typeof item !== "object" || Array.isArray(item)) throw new CmsError("invalid", itemPath);

    if (field.type === "blocks") {
      const block = field.blocks.find((it) => it.slug === (item as Item).block);
      if (!block) throw new CmsError("invalid", `${itemPath}.block`);
      items.push({ block: block.slug, ...(await parseFields(block.fields, item, "create", store, itemPath)) });
    } else if (field.type === "array") {
      items.push(await parseFields(field.fields, item, "create", store, itemPath));
    }
  }
  return items;
};

/**
 * Checks submitted values against fields and converts them to their stored form.
 * Unknown fields are dropped. When creating, required fields must be given. When editing,
 * missing fields stay as they are, and null or an empty string clears a field.
 * Lists are always given as a whole, and their items are checked like new values.
 */
export const parseFields = async (
  fields: Fields<unknown>,
  input: Record<string, unknown>,
  mode: "create" | "edit",
  store: Store,
  path?: string,
) => {
  const values: Values = {};

  for (const [name, field] of Object.entries(fields)) {
    const fieldPath = path ? `${path}.${name}` : name;
    const value = input[name];
    const empty =
      value === undefined || value === null || value === "" || (Array.isArray(value) && value.length === 0);

    if (empty) {
      if (field.required && (mode === "create" || value !== undefined)) throw new CmsError("invalid", fieldPath);
      if (value !== undefined || mode === "create") values[name] = isSingleValue(field) ? null : [];
      continue;
    }

    if (isListField(field)) {
      values[name] = await parseList(field, value, fieldPath, store);
      continue;
    }

    if (isManyRelation(field)) {
      values[name] = await parseRelations(field, value, fieldPath, store);
      continue;
    }

    const parsed: ScalarValue | undefined = await parseScalar(field, value, store);
    if (parsed === undefined || (field.validate && !field.validate(String(parsed))))
      throw new CmsError("invalid", fieldPath);

    values[name] = parsed;
  }

  return values;
};

/** Whether two stored values are the same, treating missing and empty values alike */
export const sameValue = (a: FieldValue | undefined, b: FieldValue | undefined) =>
  Array.isArray(a) || Array.isArray(b)
    ? JSON.stringify(a ?? []) === JSON.stringify(b ?? [])
    : String(a ?? "") === String(b ?? "");
