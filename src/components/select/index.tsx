import type { JSX, PropsWithChildren } from "hono/jsx";
import type { TranslationFunctions } from "../../translation";

type SelectProps = PropsWithChildren<JSX.IntrinsicElements["select"] & {
  t: TranslationFunctions["t"];
  /** Adds a search box to the list, which only pays off for long lists */
  search?: boolean;
  /** Searches the options on the server instead of listing them all */
  lookupUrl?: string;
}>;

/**
 * A native select. Only long or server-backed lists get the searchable dropdown,
 * so short ones keep the system picker and need no script.
 */
export const Select = ({ t, search, lookupUrl, children, class: className, ...attributes }: SelectProps) =>
  search || lookupUrl ? (
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
  ) : (
    <select {...attributes} class={className}>{children}</select>
  );
