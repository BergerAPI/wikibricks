import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { serializeMarkdown } from "./markdown";

export default function mount(root: HTMLElement) {
  const value = root.querySelector<HTMLInputElement>("[data-rich-text-value]")!;
  const content = root.querySelector<HTMLElement>("[data-editor-content]")!;
  const toolbar = root.querySelector<HTMLElement>("[data-editor-toolbar]")!;
  const linkForm = root.querySelector<HTMLElement>("[data-link-form]")!;
  const linkUrl = root.querySelector<HTMLInputElement>("[data-link-url]")!;
  const status = root.querySelector<HTMLElement>("[data-script-status]")!;
  const referenceForm = root.querySelector<HTMLElement>(
    "[data-reference-form]",
  );
  const reference = root.querySelector<HTMLSelectElement>(
    "[data-reference-select]",
  );
  const insertReference = root.querySelector<HTMLButtonElement>(
    "[data-reference-insert]",
  );
  const initialHtml = content.innerHTML;
  const initialValue = value.value;
  const listeners = new AbortController();
  const { signal } = listeners;
  let resetTimer: ReturnType<typeof setTimeout>;

  // Start from the same safe, server-rendered HTML that readers see.
  content.replaceChildren();
  let editor: Editor;
  try {
    editor = new Editor({
      element: content,
      content: initialHtml,
      extensions: [
        StarterKit.configure({
          underline: false,
          trailingNode: false,
          link: { openOnClick: false, HTMLAttributes: { target: null } },
        }),
      ],
      editorProps: {
        attributes: {
          class:
            "prose max-w-none min-h-48 wrap-break-words prose-headings:font-serif prose-a:text-blue-800 focus:outline-none",
          role: "textbox",
          "aria-label": root.dataset.label!,
          "aria-multiline": "true",
        },
      },
      onUpdate: ({ editor }) => {
        // Do not normalize or rewrite stored Markdown merely by opening the editor.
        value.value = editor.isEmpty ? "" : serializeMarkdown(editor.state.doc);
        value.dispatchEvent(new Event("input", { bubbles: true }));
      },
    });
  } catch (error) {
    content.innerHTML = initialHtml;
    throw error;
  }

  const commands: Record<
    string,
    { run: () => void; active?: () => boolean; enabled?: () => boolean }
  > = {
    paragraph: {
      run: () => {
        editor.chain().focus().setParagraph().run();
      },
      active: () => editor.isActive("paragraph"),
    },
    heading: {
      run: () => {
        editor.chain().focus().toggleHeading({ level: 2 }).run();
      },
      active: () => editor.isActive("heading", { level: 2 }),
    },
    subheading: {
      run: () => {
        editor.chain().focus().toggleHeading({ level: 3 }).run();
      },
      active: () => editor.isActive("heading", { level: 3 }),
    },
    bold: {
      run: () => {
        editor.chain().focus().toggleBold().run();
      },
      active: () => editor.isActive("bold"),
    },
    italic: {
      run: () => {
        editor.chain().focus().toggleItalic().run();
      },
      active: () => editor.isActive("italic"),
    },
    bulletList: {
      run: () => {
        editor.chain().focus().toggleBulletList().run();
      },
      active: () => editor.isActive("bulletList"),
    },
    orderedList: {
      run: () => {
        editor.chain().focus().toggleOrderedList().run();
      },
      active: () => editor.isActive("orderedList"),
    },
    blockquote: {
      run: () => {
        editor.chain().focus().toggleBlockquote().run();
      },
      active: () => editor.isActive("blockquote"),
    },
    link: {
      run: () => {
        if (referenceForm) referenceForm.hidden = true;
        linkForm.hidden = false;
        linkUrl.value = editor.getAttributes("link").href ?? "";
        linkUrl.setCustomValidity("");
        linkUrl.focus();
      },
      active: () => editor.isActive("link"),
    },
    entity: {
      run: () => {
        if (!referenceForm || !reference) return;
        linkForm.hidden = true;
        linkUrl.setCustomValidity("");
        referenceForm.hidden = false;
        (
          referenceForm.querySelector<HTMLElement>('[role="combobox"]') ??
          reference
        ).focus();
      },
    },
    undo: {
      run: () => {
        editor.chain().focus().undo().run();
      },
      enabled: () => editor.can().undo(),
    },
    redo: {
      run: () => {
        editor.chain().focus().redo().run();
      },
      enabled: () => editor.can().redo(),
    },
  };

  const updateToolbar = () => {
    for (const button of toolbar.querySelectorAll<HTMLButtonElement>(
      "[data-command]",
    )) {
      const command = commands[button.dataset.command!];
      if (command.active)
        button.setAttribute("aria-pressed", String(command.active()));
      button.disabled = command.enabled ? !command.enabled() : false;
    }
  };
  const closeLink = () => {
    linkForm.hidden = true;
    if (referenceForm) referenceForm.hidden = true;
    linkUrl.setCustomValidity("");
    editor.commands.focus();
  };
  const applyLink = () => {
    const href = linkUrl.value.trim();
    let valid = false;
    try {
      valid =
        !!href &&
        ["http:", "https:", "mailto:"].includes(
          new URL(href, location.origin).protocol,
        );
    } catch {
      /* Invalid URL */
    }
    linkUrl.setCustomValidity(valid ? "" : root.dataset.invalidLinkMessage!);
    if (!linkUrl.reportValidity()) return;
    if (editor.chain().focus().extendMarkRange("link").setLink({ href }).run())
      closeLink();
  };

  toolbar.addEventListener("mousedown", (event) => event.preventDefault(), {
    signal,
  });
  toolbar.addEventListener(
    "click",
    (event) => {
      const button = (event.target as HTMLElement).closest<HTMLButtonElement>(
        "[data-command]",
      );
      if (button && !button.disabled) commands[button.dataset.command!]?.run();
    },
    { signal },
  );
  root
    .querySelector("[data-link-apply]")!
    .addEventListener("click", applyLink, { signal });
  root.querySelector("[data-link-remove]")!.addEventListener(
    "click",
    () => {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      closeLink();
    },
    { signal },
  );
  root
    .querySelector("[data-link-cancel]")!
    .addEventListener("click", closeLink, { signal });
  reference?.addEventListener(
    "change",
    () => {
      if (insertReference) insertReference.disabled = !reference.value;
    },
    { signal },
  );
  insertReference?.addEventListener(
    "click",
    () => {
      const selected = reference?.selectedOptions[0];
      if (!selected?.value) return;
      const href = `/entities/${encodeURIComponent(selected.value)}`;
      const chain = editor.chain().focus();
      if (!editor.state.selection.empty || editor.isActive("link")) {
        chain.extendMarkRange("link").setLink({ href }).run();
      } else {
        chain
          .insertContent({
            type: "text",
            text: selected.label,
            marks: [{ type: "link", attrs: { href } }],
          })
          .run();
      }
      closeLink();
    },
    { signal },
  );
  root
    .querySelector("[data-reference-cancel]")
    ?.addEventListener("click", closeLink, { signal });
  linkUrl.addEventListener("input", () => linkUrl.setCustomValidity(""), {
    signal,
  });
  linkUrl.addEventListener(
    "keydown",
    (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        applyLink();
      }
      if (event.key === "Escape") {
        event.preventDefault();
        closeLink();
      }
    },
    { signal },
  );
  editor.on("transaction", updateToolbar);
  value.form?.addEventListener(
    "reset",
    (event) => {
      clearTimeout(resetTimer);
      resetTimer = setTimeout(() => {
        if (event.defaultPrevented) return;
        editor.commands.setContent(initialHtml, { emitUpdate: false });
        value.value = initialValue;
        linkForm.hidden = true;
        if (referenceForm) referenceForm.hidden = true;
        linkUrl.setCustomValidity("");
        updateToolbar();
      }, 0);
    },
    { signal },
  );
  updateToolbar();
  toolbar.hidden = false;
  status.textContent = "";
  root.dataset.editorReady = "true";
  root.dispatchEvent(new Event("rich-text:ready", { bubbles: true }));

  return () => {
    listeners.abort();
    clearTimeout(resetTimer);
    const html = editor.getHTML();
    editor.destroy();
    content.innerHTML = html;
    toolbar.hidden = true;
    linkForm.hidden = true;
    if (referenceForm) referenceForm.hidden = true;
    delete root.dataset.editorReady;
    // A detached component keeps its current Markdown value for a later remount.
    if (value.value === initialValue) content.innerHTML = initialHtml;
  };
}
