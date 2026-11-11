import type { Field } from "@wikibricks/cms";
import type { FieldUi, WikiEntry } from "../../collections";
import { displayField } from "../../fields";
import type { TranslationFunctions, Translations } from "../../translation";

// Fields without a label of their own, because the pages show them in their own place
const COMMON_LABELS: Record<string, keyof Translations> = {
  name: "entities.nameLabel",
  description: "entities.descriptionLabel",
  image_id: "entities.imageLabel",
};

/**
 * Says where a version stands in review: still waiting, or who decided on it and why.
 */
export const ReviewNotice = ({
  entry,
  reviewer,
  translation: { t, formatDate },
}: {
  entry: WikiEntry;
  reviewer?: string;
  translation: TranslationFunctions;
}) => {
  // Versions of collections without review are approved by nobody
  if (entry.status !== "pending" && !reviewer) return null;

  const decision = { reviewer: reviewer ?? "", date: entry.reviewedAt ? formatDate(entry.reviewedAt) : "" };
  const colors = {
    pending: "border-yellow-400 bg-yellow-50",
    approved: "border-green-400 bg-green-50",
    rejected: "border-red-400 bg-red-50",
  };

  return (
    <div class={`mb-3 border p-3 ${colors[entry.status]}`}>
      <p class="font-semibold">{t(`review.${entry.status}`, decision)}</p>
      {entry.reviewComment && <p class="mt-1 whitespace-pre-wrap">{entry.reviewComment}</p>}
    </div>
  );
};

/**
 * The values a version changed, next to what they were before. This is what a moderator reviews.
 */
export const VersionChanges = ({
  entry,
  previous,
  fields,
  relationNames,
  previousRelationNames,
  t,
}: {
  entry: WikiEntry;
  previous: WikiEntry;
  fields: Record<string, Field<FieldUi>>;
  relationNames: Record<string, string>;
  previousRelationNames: Record<string, string>;
  t: TranslationFunctions["t"];
}) => {
  const show = (name: string, value: unknown, names: Record<string, string>) =>
    value == null || value === "" ? "–" : displayField(fields[name], String(value), names[name]).text;

  const changes = Object.keys(fields)
    .map((name) => ({
      label: t(fields[name].meta.label ?? COMMON_LABELS[name]),
      before: show(name, previous.values[name], previousRelationNames),
      after: show(name, entry.values[name], relationNames),
    }))
    .filter((change) => change.before !== change.after);

  return (
    <section class="mb-4">
      <h2 class="text-xl font-serif pb-1 mb-2 border-b">{t("review.changes")}</h2>
      <div class="overflow-x-auto">
        <table class="w-full table-fixed border-collapse border text-sm [&_td]:border [&_td]:p-2 [&_td]:align-top [&_th]:border [&_th]:p-2 [&_th]:text-left">
          <thead>
            <tr class="bg-background">
              <th class="w-1/5">{t("review.field")}</th>
              <th>{t("review.before")}</th>
              <th>{t("review.after")}</th>
            </tr>
          </thead>
          <tbody>
            {changes.map((change) => (
              <tr>
                <th scope="row">{change.label}</th>
                <td class="whitespace-pre-wrap bg-red-50">{change.before}</td>
                <td class="whitespace-pre-wrap bg-green-50">{change.after}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
};
