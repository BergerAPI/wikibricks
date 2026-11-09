import type { JSX, PropsWithChildren } from "hono/jsx";
import type { TranslationFunctions } from "../../translation";

type SelectProps = PropsWithChildren<JSX.IntrinsicElements["select"] & {
  t: TranslationFunctions["t"];
  lookupUrl?: string;
}>;

export const Select = ({ t, lookupUrl, children, class: className, ...attributes }: SelectProps) => (
  <div
    class={`min-w-0 ${className ?? ""}`}
    data-include-script="components/select"
    data-options-url={lookupUrl}
    data-search-label={t("select.search")}
    data-loading-message={t("select.loading")}
    data-empty-message={t("select.empty")}
    data-more-message={t("select.more")}
    data-error-message={t("select.error")}
  >
    <select {...attributes} class="w-full">{children}</select>
  </div>
);
