import type { Field } from "@wikibricks/cms";
import type { FieldUi } from "../collections";
import type { FieldOptions } from "../fields";
import type { TranslationFunctions } from "../translation";

const groupColors = [
  "bg-neutral-400",
  "bg-neutral-300",
  "bg-neutral-200",
  "bg-neutral-100",
];

/**
 * Renders the input for an entity field based on its definition.
 * Extra attributes (id, name, class, data-*) are passed to the input element.
 */
export const EntityFieldInput = ({
  field,
  value,
  options = { items: [] },
  emptyLabel,
  t,
  ...attributes
}: {
  field: Field<FieldUi>;
  value?: string;
  options?: FieldOptions;
  emptyLabel?: string;
  t: TranslationFunctions["t"];
  [attribute: string]: unknown;
}) => {
  if (field.type === "relation" && options.lookupUrl) {
    const { name, "data-edit-field": editField, ...inputAttributes } = attributes;
    const id = String(attributes.id ?? `relation-${editField ?? name}`);
    const selected = options.items.find((option) => option.value === value);
    return (
      <div data-relation-picker data-options-url={options.lookupUrl}>
        <input
          {...inputAttributes}
          id={id}
          type="search"
          list={`${id}-options`}
          autocomplete="off"
          autocapitalize="none"
          spellcheck={false}
          aria-label={attributes["aria-label"] ?? (field.meta.label && t(field.meta.label))}
          aria-describedby={`${id}-status`}
          value={selected?.label ?? ""}
          placeholder={t("relation.search")}
          data-relation-search
          data-invalid-message={t("relation.choose")}
          data-loading-message={t("relation.loading")}
          data-empty-message={t("relation.empty")}
          data-more-message={t("relation.more")}
          data-error-message={t("relation.error")}
        />
        <input type="hidden" name={typeof name === "string" ? name : undefined} data-edit-field={editField} data-relation-value value={value ?? ""} />
        <datalist id={`${id}-options`}>
          {options.items.map((option) => (
            <option value={`${option.label} (#${option.value})`} data-id={option.value} data-label={option.label} />
          ))}
        </datalist>
        <p id={`${id}-status`} role="status" class="mt-1 text-xs text-gray-600">{t("relation.hint")}</p>
      </div>
    );
  }

  if (field.type === "boolean") {
    return (
      <select {...attributes} class={`${attributes.class ?? ""} pr-8`}>
        <option value="">{emptyLabel}</option>
        <option value="true" selected={value === "true"}>{t("field.yes")}</option>
        <option value="false" selected={value === "false"}>{t("field.no")}</option>
      </select>
    );
  }

  if (field.type === "select" || field.type === "relation") {
    return (
      <select {...attributes} class={`${attributes.class ?? ""} pr-8`}>
        <option value="">{emptyLabel ?? (field.meta.placeholder && t(field.meta.placeholder))}</option>
        {options.items.map((option) => (
          <option
            value={option.value}
            selected={option.value === value}
            disabled={option.disabled}
            style={{ fontWeight: option.disabled ? "bold" : "normal" }}
            class={option.disabled ? groupColors[option.depth] : ""}
          >
            {option.label}
          </option>
        ))}
      </select>
    );
  }

  return (
    <input
      {...attributes}
      type={field.type === "number" ? "number" : field.type === "date" ? (field.time ? "datetime-local" : "date") : "text"}
      value={value ?? ""}
    />
  );
};
