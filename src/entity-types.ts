import { categories, type Category } from "./categories";
import { sql, type EntityView, type Queryable } from "./database";
import type { Translations } from "./translation";
import { parseId } from "./utils";

type TranslationKey = keyof Translations;

/**
 * How a field is entered, displayed and stored.
 * - text: a plain input, stored as VARCHAR
 * - number: a number input, stored as INTEGER
 * - category: a choice from a category tree, shown by the category name
 * - reference: the ID of an entity of the given type, shown as a link to it
 */
export type FieldInput =
  | { kind: "text" }
  | { kind: "number" }
  | { kind: "category"; tree: Category[]; placeholder: TranslationKey }
  | { kind: "reference"; entityType: string; placeholder: TranslationKey };

export type FieldDefinition = {
  label: TranslationKey;
  /** Format hint shown next to the label in the creation form */
  hint?: TranslationKey;
  /** Defaults to a text input */
  input?: FieldInput;
  validate?: (value: string) => boolean;
  /** Turns a stored value into a link target */
  link?: (value: string) => string;
};

export type EntityTypeDefinition = {
  /**
   * Table holding the fields of each version. Needed as soon as a type has fields.
   * The table and the views <type>_view and <type>_versions_view are created from this definition.
   */
  table?: string;
  fields: Record<string, FieldDefinition>;
};

/**
 * All entity types. Adding one here, plus the translation of its name, is all it takes.
 */
const definitions = {
  set: {
    table: "sets",
    fields: {
      pieces: { label: "entity.pieces", input: { kind: "number" } },
      size: { label: "entity.size" },
      theme: {
        label: "entity.theme",
        input: {
          kind: "category",
          tree: categories,
          placeholder: "entities.selectTheme",
        },
      },
      issued: {
        label: "entity.issued",
        hint: "entity.issuedHint",
        // YYYY, MM.YYYY or DD.MM.YYYY
        validate: (value) => /^(\d{2}\.){0,2}\d{4}$/.test(value),
      },
      brand_id: {
        label: "entity.brand",
        input: {
          kind: "reference",
          entityType: "brand",
          placeholder: "entities.selectBrand",
        },
      },
    },
  },
  brand: {
    table: "brands",
    fields: {
      country: { label: "entity.country" },
      website: {
        label: "entity.website",
        link: (value) => {
          const full = value.startsWith("http") ? value : `https://${value}`;

          try {
            new URL(full);
            return full;
          } catch {
            return "#";
          }
        },
      },
    },
  },
  wiki: { fields: {} },
} satisfies Record<string, EntityTypeDefinition>;

export type EntityType = keyof typeof definitions;

export const entityDefinitions: Record<EntityType, EntityTypeDefinition> = definitions;

export const entityTypes = Object.keys(definitions) as EntityType[];

export const isEntityType = (value: unknown): value is EntityType =>
  entityTypes.includes(value as EntityType);

export const inputOf = (field: FieldDefinition): FieldInput =>
  field.input ?? { kind: "text" };

export type FieldOption = {
  value: string;
  label: string;
  depth: number;
  disabled: boolean;
};

// Parent categories are shown as disabled group headers
const categoryOptions = (tree: Category[], depth = 0): FieldOption[] =>
  tree.flatMap((category) => {
    const hasChildren = !!category.children?.length;
    const option = {
      value: category.id,
      label: category.name,
      depth,
      disabled: hasChildren,
    };
    return hasChildren
      ? [option, ...categoryOptions(category.children!, depth + 1)]
      : [option];
  });

/**
 * Loads the choices of all category and reference fields, keyed by field name.
 */
export const loadFieldOptions = async (
  fields: Record<string, FieldDefinition>,
  db: Queryable = sql,
) => {
  const options: Record<string, FieldOption[]> = {};

  for (const [key, field] of Object.entries(fields)) {
    const input = inputOf(field);

    if (input.kind === "category") options[key] = categoryOptions(input.tree);

    if (input.kind === "reference") {
      const entities = await db<{ id: number; name: string }[]>`
        SELECT e.id, e.name FROM entities e
        JOIN entity_versions v ON e.head_version_id = v.id
        WHERE e.type = ${input.entityType}
        ORDER BY e.name ASC
        LIMIT 500
      `;
      options[key] = entities.map((entity) => ({
        value: String(entity.id),
        label: entity.name,
        depth: 0,
        disabled: false,
      }));
    }
  }

  return options;
};

/**
 * Resolves the names of the entities an entity references, keyed by field name.
 */
export const loadReferenceNames = async (
  entity: EntityView,
  fields: Record<string, FieldDefinition>,
  db: Queryable = sql,
) => {
  const names: Record<string, string> = {};

  for (const [key, field] of Object.entries(fields)) {
    const value = entity[key];
    if (inputOf(field).kind !== "reference" || value == null) continue;

    const [reference] = await db<{ name: string }[]>`
      SELECT name FROM entities WHERE id = ${Number(value)}
    `;
    if (reference) names[key] = reference.name;
  }

  return names;
};

/**
 * The text and optional link target shown for a stored field value.
 */
export const displayField = (
  field: FieldDefinition,
  value: string,
  referenceName?: string,
): { text: string; href?: string } => {
  const input = inputOf(field);

  if (input.kind === "category") {
    const category = categoryOptions(input.tree).find(
      (it) => it.value === value,
    );
    return { text: category?.label ?? value };
  }

  if (input.kind === "reference")
    return { text: referenceName ?? value, href: `/entities/${value}` };

  return { text: value, href: field.link?.(value) };
};

const isValid = async (field: FieldDefinition, value: string, db: Queryable) => {
  const input = inputOf(field);

  if (input.kind === "number" && !/^\d+$/.test(value)) return false;

  if (
    input.kind === "category" &&
    !categoryOptions(input.tree).some(
      (it) => it.value === value && !it.disabled,
    )
  )
    return false;

  if (input.kind === "reference") {
    const id = parseId(value);
    const [entity] = id
      ? await db`SELECT 1 FROM entities WHERE id = ${id} AND type = ${input.entityType}`
      : [];
    if (!entity) return false;
  }

  return field.validate?.(value) ?? true;
};

/**
 * Validates submitted field values against a type definition. Unknown fields are dropped.
 * When creating, every field must be filled in. When editing, missing fields stay as they are
 * and empty ones are cleared.
 */
export const parseFields = async (
  definition: EntityTypeDefinition,
  submitted: unknown,
  mode: "create" | "edit",
  db: Queryable = sql,
): Promise<{ values: Record<string, string | number | null> } | { error: string }> => {
  const input = submitted ?? {};
  if (typeof input !== "object" || Array.isArray(input))
    return { error: "Bad Request" };

  const values: Record<string, string | number | null> = {};

  for (const [key, field] of Object.entries(definition.fields)) {
    const value = (input as Record<string, unknown>)[key];

    if (mode === "create" && !value) return { error: `Validation failed for ${key}` };
    if (value === undefined) continue;
    if (value === "") {
      values[key] = null;
      continue;
    }

    if (typeof value !== "string" || !(await isValid(field, value, db)))
      return { error: `Validation failed for ${key}` };

    const kind = inputOf(field).kind;
    values[key] = kind === "number" || kind === "reference" ? Number(value) : value;
  }

  return { values };
};
