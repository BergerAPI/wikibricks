import type { Field } from "@wikibricks/cms";
import type { JSX } from "hono/jsx";
import type { FieldUi } from "../collections";
import type { FieldOption, FieldOptions } from "../fields";
import type { TranslationFunctions } from "../translation";
import { Select } from "./select";

// Shorter lists are quicker to scan than to search.
const SEARCHABLE_FROM = 10;

const optionGroups =(options: FieldOption[]) => {
  const groups: { label: string; items: FieldOption[] }[] = [];
  for (const option of options) {
    const label = option.group ?? "";
    if (groups.at(-1)?.label !== label) groups.push({ label, items: [] });
    groups.at(-1)!.items.push(option);
  }
  return groups;
};

type FieldInputProps = Omit<JSX.IntrinsicElements["input"], "type" | "value" | "children"> & {
  field: Field<FieldUi>;
  value?: string;
  options?: FieldOptions;
  emptyLabel?: string;
  t: TranslationFunctions["t"];
};

export const EntityFieldInput = ({
  field,
  value,
  options = { items: [] },
  emptyLabel,
  t,
  ...attributes
}: FieldInputProps) => {
  if (field.type === "boolean") {
    return (
      <select {...attributes}>
        <option value="">{emptyLabel ?? t("select.placeholder")}</option>
        <option value="true" selected={value === "true"}>{t("field.yes")}</option>
        <option value="false" selected={value === "false"}>{t("field.no")}</option>
      </select>
    );
  }

  if (field.type === "select" || field.type === "relation") {
    return (
      <Select {...attributes} t={t} lookupUrl={options.lookupUrl} search={options.items.length > SEARCHABLE_FROM}>
        <option value="">{emptyLabel ?? t(field.meta.placeholder ?? "select.placeholder")}</option>
        {optionGroups(options.items).map((group) => {
          const choices = group.items.map((option) => <option value={option.value} selected={option.value === value}>{option.label}</option>);
          return group.label ? <optgroup label={group.label}>{choices}</optgroup> : choices;
        })}
      </Select>
    );
  }

  let type = "text";
  if (field.type === "number") type = "number";
  if (field.type === "date") type = field.time ? "datetime-local" : "date";

  return (
    <input
      {...attributes}
      type={type}
      value={value ?? ""}
      maxlength={field.type === "text" ? field.maxLength : undefined}
    />
  );
};
