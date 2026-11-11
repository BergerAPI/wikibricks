import type { Child } from "hono/jsx";
import type { WikiEntry } from "../../collections";
import type { TranslationFunctions } from "../../translation";

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

export const ChangedValue = ({
  before,
  after,
  t,
}: {
  before: Child;
  after: Child;
  t: TranslationFunctions["t"];
}) => (
  <>
    <del class="rounded bg-red-100 px-1 text-red-950 line-through">
      <span class="sr-only">{t("review.before")}{" "}</span>{before ?? "–"}
    </del>{" "}
    <ins class="rounded bg-green-100 px-1 text-green-950 no-underline">
      <span class="sr-only">{t("review.after")}{" "}</span>{after ?? "–"}
    </ins>
  </>
);
