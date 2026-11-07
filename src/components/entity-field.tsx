import { inputOf, type FieldDefinition, type FieldOption } from "../entity-types";
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
  field: FieldDefinition;
  value?: string;
  options?: FieldOption[];
  t: TranslationFunctions["t"];
  [attribute: string]: unknown;
}) => {
  const input = inputOf(field);

  if (input.kind === "category" || input.kind === "reference") {
    return (
      <select {...attributes}>
        <option value="">{t(input.placeholder)}</option>
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
      type={input.kind === "number" ? "number" : "text"}
      value={value ?? ""}
    />
  );
};
