import { isSingleValue, type Field, type Where } from "@wikibricks/cms";
import type { FieldUi } from "./collections";

export const searchableFields = (fields: Record<string, Field<FieldUi>>) =>
  Object.fromEntries(Object.entries(fields).filter(([, field]) =>
    field.meta.label && isSingleValue(field) && field.type !== "external",
  ));

/** Only the selected collection's fields can become CMS query conditions. */
export function readSearchFilters(fields: Record<string, Field<FieldUi>>, query: URLSearchParams) {
  const where: Where = {};
  const params = new URLSearchParams();

  const read = (key: string) => {
    const value = query.get(key)?.trim() ?? "";
    if (value) params.set(key, value);
    return value;
  };
  const integer = (value: string) => {
    const number = Number(value);
    // Numeric fields and relation IDs are stored as Postgres integers.
    if (!Number.isInteger(number) || number < -2147483648 || number > 2147483647)
      throw new Error("Invalid search filter");
    return number;
  };

  for (const [name, field] of Object.entries(fields)) {
    const key = `filter.${name}`;
    if (field.type === "number") {
      const min = read(`${key}.min`);
      const max = read(`${key}.max`);
      if (min || max) where[name] = {
        ...(min ? { gte: integer(min) } : {}),
        ...(max ? { lte: integer(max) } : {}),
      };
      continue;
    }

    const value = read(key);
    if (!value) continue;
    switch (field.type) {
      case "text": where[name] = { contains: value }; break;
      case "select":
        if (!field.options.includes(value)) throw new Error("Invalid search filter");
        where[name] = value;
        break;
      case "relation": where[name] = integer(value); break;
      case "boolean":
        if (value !== "true" && value !== "false") throw new Error("Invalid search filter");
        where[name] = value === "true";
        break;
      case "date": {
        const date = new Date(value);
        if (!Number.isFinite(date.getTime()) || (!field.time && date.toISOString().slice(0, 10) !== value))
          throw new Error("Invalid search filter");
        where[name] = field.time ? date.toISOString() : value;
        break;
      }
    }
  }
  return { where, params };
}
