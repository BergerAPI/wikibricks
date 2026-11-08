import { createCMS, type Collections, type Entry, type Field } from "@wikibricks/cms";
import { postgresAdapter } from "@wikibricks/cms-postgres";
import { categories, type Category } from "./categories";
import { sql } from "./database";
import { migrations } from "./migrations";
import type { Translations } from "./translation";

type TranslationKey = keyof Translations;

/**
 * How wikibricks presents a field. Fields without a label are left out of the info box
 * and the field forms, because the pages show them in their own place.
 */
export type FieldUi = {
  label?: TranslationKey;
  /** Format hint shown next to the label in the creation form */
  hint?: TranslationKey;
  /** First, empty option of select and relation fields */
  placeholder?: TranslationKey;
  /** Shows the options of a select field as this tree, with the parents as group headers */
  tree?: Category[];
  /** Turns a stored value into a link target */
  link?: (value: string) => string;
};

const leafIds = (tree: Category[]): string[] =>
  tree.flatMap((category) => (category.children?.length ? leafIds(category.children) : [category.id]));

// Every entity has a unique name, a description and may have an image
const common = {
  name: {
    type: "text",
    maxLength: 255,
    required: true,
    unique: true,
    validate: (value) => value.trim().length >= 3,
    meta: {},
  },
  description: {
    type: "text",
    required: true,
    validate: (value) => value.trim().length >= 3 && value.length <= 20000,
    meta: {},
  },
  image_id: { type: "external", table: "images", meta: {} },
} satisfies Record<string, Field<FieldUi>>;

/**
 * All entity types. Adding one here, plus the translation of its name, is all it takes:
 * its table, columns and views are created on startup.
 */
const collections = {
  set: {
    dbName: "sets",
    title: "name",
    fields: {
      ...common,
      pieces: {
        type: "number",
        required: true,
        validate: (value) => Number(value) >= 0,
        meta: { label: "entity.pieces" },
      },
      size: { type: "text", maxLength: 64, required: true, meta: { label: "entity.size" } },
      theme: {
        type: "select",
        options: leafIds(categories),
        required: true,
        meta: { label: "entity.theme", placeholder: "entities.selectTheme", tree: categories },
      },
      issued: {
        type: "text",
        maxLength: 64,
        required: true,
        // YYYY, MM.YYYY or DD.MM.YYYY
        validate: (value) => /^(\d{2}\.){0,2}\d{4}$/.test(value),
        meta: { label: "entity.issued", hint: "entity.issuedHint" },
      },
      brand_id: {
        type: "relation",
        to: "brand",
        required: true,
        meta: { label: "entity.brand", placeholder: "entities.selectBrand" },
      },
    },
  },
  brand: {
    dbName: "brands",
    title: "name",
    fields: {
      ...common,
      country: { type: "text", maxLength: 255, required: true, meta: { label: "entity.country" } },
      website: {
        type: "text",
        maxLength: 255,
        required: true,
        meta: {
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
  },
  wiki: { dbName: "wikis", title: "name", fields: { ...common } },
} satisfies Collections<FieldUi>;

export const cms = createCMS({
  db: postgresAdapter({ sql, migrations, actorTable: "users" }),
  collections,
});

export type EntityType = keyof typeof collections;
export type WikiEntry = Entry<EntityType>;

export const fieldsOf = (type: EntityType): Record<string, Field<FieldUi>> => collections[type].fields;
