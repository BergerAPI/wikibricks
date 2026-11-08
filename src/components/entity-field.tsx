import type { Field } from "@wikibricks/cms";
import type { FieldUi } from "../collections";
import type { FieldOption } from "../fields";
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
  options = [],
  t,
  ...attributes
}: {
  field: Field<FieldUi>;
  value?: string;
  options?: FieldOption[];
  t: TranslationFunctions["t"];
  [attribute: string]: unknown;
}) => {
  if (field.type === "select" || field.type === "relation") {
    return (
      <select {...attributes}>
        <option value="">{field.meta.placeholder && t(field.meta.placeholder)}</option>
        {options.map((option) => (
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
      type={field.type === "number" ? "number" : "text"}
      value={value ?? ""}
    />
  );
};
