import type { Child, JSX, PropsWithChildren } from "hono/jsx";
import type { TranslationFunctions } from "../translation";

/**
 * The heading of a page, with the actions on it at the side.
 */
export const PageTitle = ({ children, actions }: PropsWithChildren<{ actions?: Child }>) => (
  <div class="mb-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b pb-2">
    <h1 class="font-serif text-3xl">{children}</h1>
    {actions && <div class="flex flex-wrap items-center gap-x-4 [&>a]:inline-flex [&>a]:min-h-11 [&>a]:items-center">{actions}</div>}
  </div>
);

const tones = {
  plain: "border-gray-200 bg-background",
  success: "border-green-400 bg-green-50",
  warning: "border-yellow-400 bg-yellow-50",
  error: "border-red-400 bg-red-50 text-red-800",
};

export type Tone = keyof typeof tones;

/**
 * A box with a message, like an empty list, a confirmation or an error. Scripts fill the empty error boxes.
 */
export const Notice = ({ tone = "plain", children, class: className = "", ...attributes }: PropsWithChildren<
  JSX.IntrinsicElements["div"] & { tone?: Tone }
>) => (
  <div {...attributes} class={`mb-3 border p-3 empty:hidden ${tones[tone]} ${className}`}>{children}</div>
);

export const Badge = ({ tone = "plain", children }: PropsWithChildren<{ tone?: Tone }>) => (
  <span class={`rounded border px-1.5 text-sm ${tones[tone]}`}>{children}</span>
);

/**
 * Links between the views of a page, the current one underlined.
 */
export const Tabs = ({ label, tabs }: { label: string; tabs: { href: string; current: boolean; children: Child }[] }) => (
  <nav aria-label={label} class="mb-4 flex flex-wrap gap-x-1 border-b">
    {tabs.map(({ href, current, children }) => (
      <a
        href={href}
        aria-current={current ? "page" : undefined}
        class="-mb-px inline-flex min-h-11 items-center gap-2 border-b-2 border-transparent px-3 aria-[current]:border-blue-800 aria-[current]:font-semibold aria-[current]:text-black"
      >
        {children}
      </a>
    ))}
  </nav>
);

/**
 * A list of entries that reads well on any screen: details sit beside the entry
 * where there is room and wrap below it on a phone.
 */
export const RowList = ({ children }: PropsWithChildren) => (
  <ul class="mt-4 list-none space-y-0 divide-y border bg-white p-0">{children}</ul>
);

export const Row = ({ children, details }: PropsWithChildren<{ details?: Child }>) => (
  <li class="flex flex-col gap-x-4 gap-y-0.5 px-3 py-2.5 sm:flex-row sm:items-baseline sm:justify-between">
    <div class="min-w-0">{children}</div>
    {details && <Meta class="shrink-0">{details}</Meta>}
  </li>
);

/**
 * Small facts about something, like its author and date, in a row.
 */
export const Meta = ({ children, class: className = "" }: PropsWithChildren<{ class?: string }>) => (
  <p class={`flex flex-wrap items-baseline gap-x-3 text-sm text-gray-600 ${className}`}>{children}</p>
);

/**
 * A row of fields that filter a list, sent with the button at the end.
 */
export const FilterForm = ({ action, button, children }: PropsWithChildren<{ action: string; button: string }>) => (
  <form method="get" action={action} role="search" class="flex flex-wrap gap-2 [&>:not(button)]:min-w-40 [&>:not(button)]:flex-1">
    {children}
    <button type="submit" class="button-secondary">{button}</button>
  </form>
);

/**
 * Previous and next links, for lists loaded one item beyond the page to know whether more follow.
 */
export const Pager = ({ page, more, pageUrl, t }: {
  page: number;
  more: boolean;
  pageUrl: (page: number) => string;
  t: TranslationFunctions["t"];
}) =>
  page === 0 && !more ? null : (
    <nav aria-label={t("action.pages")} class="mt-4 flex flex-wrap items-center justify-center gap-3 [&>a]:inline-flex [&>a]:min-h-11 [&>a]:items-center [&>a]:border [&>a]:bg-white [&>a]:px-3">
      {page > 0 && <a rel="prev" href={pageUrl(page - 1)}>{t("action.previous")}</a>}
      <span class="text-sm text-gray-600">{t("action.page", { page: String(page + 1) })}</span>
      {more && <a rel="next" href={pageUrl(page + 1)}>{t("action.next")}</a>}
    </nav>
  );

/**
 * The box of facts at the side of an entity or user page.
 */
export const InfoBox = ({ title, children }: PropsWithChildren<{ title: string }>) => (
  <div class="md:float-right md:clear-both md:ml-4 md:w-64 w-full shrink-0 bg-background border mb-4 p-2">
    <table class="w-full table-fixed border-spacing-0.5 leading-6">
      <colgroup>
        <col class="w-2/5" />
        <col />
      </colgroup>
      <tbody>
        <tr>
          <th colspan={2} class="pb-1">
            {title}
          </th>
        </tr>
        {children}
      </tbody>
    </table>
  </div>
);

export const InfoBoxImage = ({ src, srcset, alt, class: className = "" }: { src: string; srcset?: string; alt: string; class?: string }) => (
  <tr>
    <td colspan={2}>
      <img
        class={`mx-auto w-full h-auto px-1 ${className}`}
        src={src}
        srcset={srcset}
        width="800"
        height="800"
        loading="lazy"
        decoding="async"
        alt={alt}
      />
    </td>
  </tr>
);

export const InfoBoxRow = ({ label, children }: PropsWithChildren<{ label: string }>) => (
  <tr>
    <th scope="row" class="py-1 pr-2 text-left align-top hyphens-auto">
      {label}
    </th>
    <td class="py-1 text-left align-top">{children}</td>
  </tr>
);
