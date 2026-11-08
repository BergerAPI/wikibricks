import type { Entry, Fields, Item, Values } from "./types";

// The fields of an item of a list, which for blocks depend on its kind
const itemFields = (field: Fields<unknown>[string], item: Item) => {
  if (field.type === "array") return field.fields;
  if (field.type === "blocks") return field.blocks.find((block) => block.slug === item.block)?.fields;
};

/** Collects the IDs of all relations in some values, following lists */
export const relationIds = (fields: Fields<unknown>, values: Values | Item, ids: Set<number>) => {
  for (const [name, field] of Object.entries(fields)) {
    const value = values[name];

    if (field.type === "relation") {
      for (const id of [value].flat()) if (typeof id === "number") ids.add(id);
      continue;
    }

    for (const item of field.type === "array" || field.type === "blocks" ? ((value ?? []) as Item[]) : []) {
      const nested = itemFields(field, item);
      if (nested) relationIds(nested, item, ids);
    }
  }
};

/**
 * Values with the IDs in relations replaced by the entries they point to. Relations to
 * missing entries become null, or are left out of lists.
 */
export const withRelated = <V extends Values | Item>(
  fields: Fields<unknown>,
  values: V,
  related: Map<number, Entry>,
): V => {
  const result: Record<string, unknown> = { ...values };

  for (const [name, field] of Object.entries(fields)) {
    const value = values[name];

    if (field.type === "relation") {
      result[name] = Array.isArray(value)
        ? (value as number[]).flatMap((id) => related.get(id) ?? [])
        : (typeof value === "number" && related.get(value)) || null;
    } else if (field.type === "array" || field.type === "blocks") {
      result[name] = ((value ?? []) as Item[]).map((item) => {
        const nested = itemFields(field, item);
        return nested ? withRelated(nested, item, related) : item;
      });
    }
  }

  return result as V;
};
