import { raw } from "hono/html";
import { renderMarkdown } from "../../markdown";
import type { Translations, TranslationFunctions } from "../../translation";
import { Select } from "../select";
import { DescriptionDiff } from "./diff";

export { ChangedValue } from "./diff";

export const RichText = ({ value, previous, link }: {
  value: string;
  /** Maps links within the site to their address in the current language */
  link?: (href: string) => string;
  previous?: { value: string; t: TranslationFunctions["t"] };
}) => (
  <div class="prose max-w-none prose-headings:font-serif prose-a:text-blue-800">
    {previous && previous.value !== value
      ? <DescriptionDiff before={previous.value} after={value} beforeLabel={previous.t("review.before")} afterLabel={previous.t("review.after")} />
      : raw(renderMarkdown(value, link))}
  </div>
);

// Icon outlines on a 24 unit grid, drawn with a stroke
const icons = {
  bold: "M6 12h8a4 4 0 0 0 0-8H6zm0 0h9a4 4 0 0 1 0 8H6z",
  italic: "M19 4h-9M14 20H5M15 4 9 20",
  strike: "M16 4H9a3 3 0 0 0-2.83 4M14 12a4 4 0 0 1 0 8H6M4 12h16",
  code: "m16 18 6-6-6-6M8 6l-6 6 6 6",
  bulletList: "M9 6h12M9 12h12M9 18h12M4 6h.01M4 12h.01M4 18h.01",
  orderedList: "M10 6h11M10 12h11M10 18h11M4 4v4M3 18h3l-3 3h3M3 10h2",
  blockquote: "M4 7h6v6H6l-2 4zM14 7h6v6h-4l-2 4z",
  link: "M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7",
  entity: "M3 10h18v9H3zM6 10V7h4v3M14 10V7h4v3",
  horizontalRule: "M3 12h18M8 7h8M8 17h8",
  undo: "M9 14 4 9l5-5M4 9h11a5 5 0 0 1 0 10h-3",
  redo: "m15 14 5-5-5-5M20 9H9a5 5 0 0 0 0 10h3",
};

type Command = keyof typeof icons;

// The toolbar in groups, each command with its label and keyboard shortcut
const groups: [Command, keyof Translations, string?][][] = [
  [["bold", "editor.bold", "B"], ["italic", "editor.italic", "I"], ["strike", "editor.strike", "Shift+S"], ["code", "editor.code", "E"]],
  [["bulletList", "editor.bulletList", "Shift+8"], ["orderedList", "editor.orderedList", "Shift+7"], ["blockquote", "editor.blockquote", "Shift+B"]],
  [["link", "editor.link", "K"], ["entity", "editor.entity"], ["horizontalRule", "editor.horizontalRule"]],
  [["undo", "editor.undo", "Z"], ["redo", "editor.redo", "Shift+Z"]],
];

const blockTypes = [
  ["paragraph", "editor.paragraph"],
  ["heading", "editor.heading"],
  ["subheading", "editor.subheading"],
  ["codeBlock", "editor.codeBlock"],
] as const;

const Icon = ({ path }: { path: string }) => (
  <svg viewBox="0 0 24 24" class="size-5 fill-none stroke-current stroke-2 [stroke-linecap:round] [stroke-linejoin:round]" aria-hidden="true">
    <path d={path} />
  </svg>
);

const formClass = "flex flex-wrap items-end gap-2 border-b bg-background p-2";

export const RichTextEditor = ({
  id,
  name,
  value,
  t,
  referenceUrl,
  maxLength = 20000,
}: {
  id: string;
  name: string;
  value: string;
  t: TranslationFunctions["t"];
  referenceUrl?: string;
  maxLength?: number;
}) => (
  <div
    class="flow-root min-w-0 mb-4 rounded border border-gray-300 bg-white focus-within:border-blue-600"
    data-include-script="components/rich-text"
    data-rich-text-editor
    data-label={t("entities.descriptionLabel")}
    data-placeholder={t("editor.placeholder")}
    data-max-length={maxLength}
    data-characters={t("editor.characters")}
    data-script-error-message={t("editor.error")}
    data-invalid-link-message={t("editor.invalidLink")}
  >
    <input type="hidden" name={name} value={value} data-rich-text-value />
    {/* Stays in view while scrolling through a long text */}
    <div
      data-editor-toolbar
      role="toolbar"
      aria-label={t("editor.formatting")}
      class="sticky top-0 z-10 flex items-center gap-1 overflow-x-auto rounded-t border-b bg-white p-1"
      hidden
    >
      <select data-block-type aria-label={t("editor.blockType")} class="min-h-10 shrink-0 py-1 text-sm">
        {blockTypes.map(([type, label]) => <option value={type}>{t(label)}</option>)}
      </select>
      {groups.map((group) => (
        <div class="flex shrink-0 items-center border-l pl-1">
          {group
            .filter(([command]) => command !== "entity" || referenceUrl)
            .map(([command, label, shortcut]) => (
              <button
                type="button"
                data-command={command}
                data-shortcut={shortcut}
                title={t(label)}
                aria-label={t(label)}
                class="inline-flex size-10 min-h-10 items-center justify-center rounded border-transparent p-0 text-gray-700 hover:bg-gray-100 disabled:opacity-40 aria-pressed:border-blue-200 aria-pressed:bg-blue-50 aria-pressed:text-blue-800"
              >
                <Icon path={icons[command]} />
              </button>
            ))}
        </div>
      ))}
    </div>

    {/* Shown while the cursor is in a link */}
    <div data-link-info class="flex flex-wrap items-center gap-x-3 border-b bg-background px-3 py-1 text-sm" hidden>
      <a data-link-open target="_blank" rel="noopener noreferrer" class="min-w-0 truncate"></a>
      <button type="button" data-link-edit class="button-link ml-auto min-h-9">{t("editor.editLink")}</button>
      <button type="button" data-link-remove class="button-link min-h-9 text-red-700">{t("editor.removeLink")}</button>
    </div>

    {referenceUrl && (
      <div data-reference-form class={`${formClass} [&_.option[data-value='']]:hidden`} hidden>
        <div class="min-w-0 flex-1 basis-48">
          <label for={`${id}-reference`} class="block text-sm">
            {t("editor.searchEntities")}
          </label>
          <Select t={t} lookupUrl={referenceUrl} id={`${id}-reference`} data-reference-select>
            <option value="">{t("select.placeholder")}</option>
          </Select>
        </div>
        <button type="button" class="button-secondary" data-form-cancel>
          {t("entity.cancel")}
        </button>
      </div>
    )}

    <div data-link-form class={formClass} hidden>
      <label class="min-w-0 flex-1 basis-40" data-link-text-label>
        <span class="block text-sm">{t("editor.linkText")}</span>
        <input type="text" data-link-text class="w-full" />
      </label>
      <label class="min-w-0 flex-1 basis-48">
        <span class="block text-sm">{t("editor.linkAddress")}</span>
        <input type="text" inputmode="url" data-link-url placeholder="https://…" class="w-full" />
      </label>
      <button type="button" data-link-apply class="button-primary">
        {t("editor.applyLink")}
      </button>
      <button type="button" class="button-secondary" data-form-cancel>
        {t("entity.cancel")}
      </button>
    </div>

    <div id={id} data-editor-content class="p-3">
      <RichText value={value} />
    </div>
    <p class="flex flex-wrap justify-between gap-x-4 border-t px-3 py-1.5 text-sm text-gray-500">
      <span role="status" data-script-status>{t("editor.loading")}</span>
      {referenceUrl && <span data-editor-hint hidden>{t("editor.entityHint")}</span>}
      <span data-character-count aria-live="polite"></span>
    </p>
  </div>
);
