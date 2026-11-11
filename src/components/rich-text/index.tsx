import { raw } from "hono/html";
import { renderMarkdown } from "../../markdown";
import type { TranslationFunctions } from "../../translation";
import { Select } from "../select";
import { DescriptionDiff } from "./diff";

export const RichText = ({ value, previous }: {
  value: string;
  previous?: { value: string; t: TranslationFunctions["t"] };
}) => (
  <div class="prose max-w-none prose-headings:font-serif prose-a:text-blue-800">
    {previous && previous.value !== value
      ? <DescriptionDiff before={previous.value} after={value} beforeLabel={previous.t("review.before")} afterLabel={previous.t("review.after")} />
      : raw(renderMarkdown(value))}
  </div>
);

export const RichTextEditor = ({
  id,
  name,
  value,
  t,
  referenceUrl,
}: {
  id: string;
  name: string;
  value: string;
  t: TranslationFunctions["t"];
  referenceUrl?: string;
}) => (
  <div
    class="flow-root min-w-0 mb-4 rounded border border-gray-300 bg-white focus-within:border-blue-600"
    data-include-script="components/rich-text"
    data-rich-text-editor
    data-label={t("entities.descriptionLabel")}
    data-script-error-message={t("editor.error")}
    data-invalid-link-message={t("editor.invalidLink")}
  >
    <input type="hidden" name={name} value={value} data-rich-text-value />
    <div
      data-editor-toolbar
      role="group"
      aria-label={t("editor.formatting")}
      class="flex flex-wrap gap-0.5 border-b p-1"
      hidden
    >
      {(
        [
          ["paragraph", "editor.paragraph", "¶"],
          ["heading", "editor.heading", "H2"],
          ["subheading", "editor.subheading", "H3"],
          ["bold", "editor.bold", <strong>B</strong>],
          ["italic", "editor.italic", <em>I</em>],
          ["bulletList", "editor.bulletList", "• ≡"],
          ["orderedList", "editor.orderedList", "1. ≡"],
          ["blockquote", "editor.blockquote", "❝"],
          ["link", "editor.link", t("editor.link")],
          ...(referenceUrl ? [["entity", "editor.entity", t("editor.entity")] as const] : []),
          ["undo", "editor.undo", "↶"],
          ["redo", "editor.redo", "↷"],
        ] as const
      ).map(([command, label, icon]) => (
        <button
          type="button"
          data-command={command}
          title={t(label)}
          aria-label={t(label)}
          class="min-w-11 rounded border-transparent px-2 hover:bg-gray-100 disabled:opacity-40 aria-pressed:border-blue-200 aria-pressed:bg-blue-50 aria-pressed:text-blue-800"
        >
          {icon}
        </button>
      ))}
    </div>
    {referenceUrl && (
      <div
        data-reference-form
        class="flex flex-wrap items-end gap-2 border-b p-2 [&_.option[data-value='']]:hidden"
        hidden
      >
        <div class="min-w-0 flex-1 basis-48">
          <label for={`${id}-reference`} class="block text-sm">
            {t("editor.searchEntities")}
          </label>
          <Select
            t={t}
            lookupUrl={referenceUrl}
            id={`${id}-reference`}
            data-reference-select
          >
            <option value="">{t("select.placeholder")}</option>
          </Select>
        </div>
        <button type="button" data-reference-cancel>
          {t("entity.cancel")}
        </button>
      </div>
    )}
    <div
      data-link-form
      class="flex flex-wrap items-end gap-2 border-b p-2"
      hidden
    >
      <label class="min-w-0 flex-1 basis-48">
        <span class="block text-sm">{t("editor.linkAddress")}</span>
        <input
          type="text"
          inputmode="url"
          data-link-url
          placeholder="https://…"
          class="w-full"
        />
      </label>
      <button type="button" data-link-apply>
        {t("editor.applyLink")}
      </button>
      <button type="button" data-link-remove>
        {t("editor.removeLink")}
      </button>
      <button type="button" data-link-cancel>
        {t("entity.cancel")}
      </button>
    </div>
    <div id={id} data-editor-content class="p-3">
      <RichText value={value} />
    </div>
    <p
      role="status"
      data-script-status
      class="px-3 py-2 text-sm text-gray-500 empty:hidden"
    >
      {t("editor.loading")}
    </p>
  </div>
);
