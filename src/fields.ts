import { targetsOf, type Field } from "@wikibricks/cms";
import type { Category } from "./categories";
import { cms, fieldsOf, type EntityType, type FieldUi, type WikiEntry } from "./collections";

export type FieldOption = {
  value: string;
  label: string;
  group?: string;
};

export type FieldOptions = { items: FieldOption[]; lookupUrl?: string };

// Beyond this size, relation fields look up matching entries instead of listing them all.
const RELATION_SELECT_LIMIT = 40;

const treeOptions = (tree: Category[], path: string[] = []): FieldOption[] =>
  tree.flatMap(({ id, name, children }) => children?.length
    ? treeOptions(children, [...path, name])
    : [{ value: id, label: name, group: path.join(" / ") }],
  );

/**
 * Loads the choices of all select and relation fields, keyed by field name.
 */
export const loadFieldOptions = async (type: EntityType, values: Record<string, unknown> = {}) => {
  const options: Record<string, FieldOptions> = {};

  for (const [name, field] of Object.entries(fieldsOf(type))) {
    if (field.type === "select") {
      options[name] = {
        items: field.meta.tree
          ? treeOptions(field.meta.tree)
          : field.options.map((value) => ({ value, label: value })),
      };
    }

    if (field.type === "relation") {
      const where = { type: { in: [...targetsOf(field)] } };
      const result = await cms.find({ where, sort: "title", limit: RELATION_SELECT_LIMIT });
      const remote = result.total > RELATION_SELECT_LIMIT;
      let items = result.items;
      if (remote) {
        items = values[name]
          ? (await cms.find({ where: { ...where, id: Number(values[name]) }, limit: 1 })).items
          : [];
      }
      options[name] = {
        items: items.map((entry) => ({
          value: String(entry.entityId),
          label: entry.title ?? String(entry.entityId),
        })),
        lookupUrl: remote ? `/entities/options/${type}/${name}` : undefined,
      };
    }
  }

  return options;
};

/**
 * Resolves the names of the entities an entry relates to, keyed by field name.
 */
export const loadRelationNames = async (entry: WikiEntry, fields: Record<string, Field<FieldUi>>) => {
  const names: Record<string, string> = {};

  for (const [name, field] of Object.entries(fields)) {
    const id = entry.values[name];
    if (field.type !== "relation" || id == null) continue;

    const { items } = await cms.find({ type: field.to as EntityType, where: { id: Number(id) } });
    names[name] = items[0]?.title ?? String(id);
  }

  return names;
};

/**
 * The text and optional link target shown for a stored field value.
 */
export const displayField = (
  field: Field<FieldUi>,
  value: string,
  relationName?: string,
): { text: string; href?: string } => {
  if (field.type === "select" && field.meta.tree) {
    const category = treeOptions(field.meta.tree).find((option) => option.value === value);
    return { text: category?.label ?? value };
  }

  if (field.type === "relation") return { text: relationName ?? value, href: `/entities/${value}` };

  return { text: value, href: field.meta.link?.(value) };
};
