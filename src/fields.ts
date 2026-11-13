import { targetsOf, type Field } from "@wikibricks/cms";
import type { Category } from "./categories";
import { cms, fieldsOf, type EntityType, type FieldUi, type WikiEntry } from "./collections";
import type { SelectOption } from "./shared/contracts";
import { entityPath } from "./urls";

export type FieldOption = SelectOption;

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
      let items = await cms.list({ where, sort: "title", limit: RELATION_SELECT_LIMIT + 1 });
      const remote = items.length > RELATION_SELECT_LIMIT;
      if (remote) {
        items = values[name]
          ? await cms.list({ where: { ...where, id: Number(values[name]) }, limit: 1 })
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
  const relations = Object.entries(fields).flatMap(([name, field]) => {
    const id = entry.values[name];
    return field.type === "relation" && typeof id === "number" ? [{ name, id, targets: targetsOf(field) }] : [];
  });
  if (relations.length === 0) return {};

  const ids = [...new Set(relations.map(({ id }) => id))];
  const items = await cms.list({ where: { id: { in: ids } } });
  const byId = new Map(items.map((item) => [item.entityId, item]));
  return Object.fromEntries(relations.map(({ name, id, targets }) => {
    const item = byId.get(id);
    return [name, (item && targets.includes(item.type) ? item.title : null) ?? String(id)];
  }));
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

  if (field.type === "relation") return { text: relationName ?? value, href: entityPath({ entityId: Number(value), title: relationName }) };

  return { text: value, href: field.meta.link?.(value) };
};
