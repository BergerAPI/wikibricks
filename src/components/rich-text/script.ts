import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import type TomSelect from "tom-select/base";
import { serializeMarkdown } from "./markdown";

type Command = { run: () => void; active?: () => boolean; enabled?: () => boolean };

export default function mount(root: HTMLElement) {
  const value = root.querySelector<HTMLInputElement>("[data-rich-text-value]")!;
  const content = root.querySelector<HTMLElement>("[data-editor-content]")!;
  const toolbar = root.querySelector<HTMLElement>("[data-editor-toolbar]")!;
  const linkForm = root.querySelector<HTMLElement>("[data-link-form]")!;
  const linkUrl = root.querySelector<HTMLInputElement>("[data-link-url]")!;
  const status = root.querySelector<HTMLElement>("[data-script-status]")!;
  // Only editors that can link entities have the reference form.
  const referenceForm = root.querySelector<HTMLElement>("[data-reference-form]");
  const reference = root.querySelector<HTMLSelectElement>("[data-reference-select]");

  // Start from the same safe, server-rendered HTML that readers see.
  const initialHtml = content.innerHTML;
  content.replaceChildren();
  const editor = new Editor({
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
        class: "prose max-w-none min-h-48 prose-headings:font-serif prose-a:text-blue-800 focus:outline-none",
        role: "textbox",
        "aria-label": root.dataset.label!,
        "aria-multiline": "true",
      },
    },
    // Only edits update the value, so opening the editor never rewrites the stored Markdown.
    onUpdate: ({ editor }) => {
      value.value = editor.isEmpty ? "" : serializeMarkdown(editor.state.doc);
      value.dispatchEvent(new Event("input", { bubbles: true }));
    },
  });

  const showForm = (form: HTMLElement | null) => {
    linkForm.hidden = form !== linkForm;
    if (referenceForm) referenceForm.hidden = form !== referenceForm;
    linkUrl.setCustomValidity("");
  };
  const closeForms = () => {
    showForm(null);
    editor.commands.focus();
  };

  const commands: Record<string, Command> = {
    paragraph: {
      run: () => editor.chain().focus().setParagraph().run(),
      active: () => editor.isActive("paragraph"),
    },
    heading: {
      run: () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
      active: () => editor.isActive("heading", { level: 2 }),
    },
    subheading: {
      run: () => editor.chain().focus().toggleHeading({ level: 3 }).run(),
      active: () => editor.isActive("heading", { level: 3 }),
    },
    bold: {
      run: () => editor.chain().focus().toggleBold().run(),
      active: () => editor.isActive("bold"),
    },
    italic: {
      run: () => editor.chain().focus().toggleItalic().run(),
      active: () => editor.isActive("italic"),
    },
    bulletList: {
      run: () => editor.chain().focus().toggleBulletList().run(),
      active: () => editor.isActive("bulletList"),
    },
    orderedList: {
      run: () => editor.chain().focus().toggleOrderedList().run(),
      active: () => editor.isActive("orderedList"),
    },
    blockquote: {
      run: () => editor.chain().focus().toggleBlockquote().run(),
      active: () => editor.isActive("blockquote"),
    },
    link: {
      run: () => {
        showForm(linkForm);
        linkUrl.value = editor.getAttributes("link").href ?? "";
        linkUrl.focus();
      },
      active: () => editor.isActive("link"),
    },
    entity: {
      run: () => {
        showForm(referenceForm);
        // The searchable select puts its own control in front of the native one.
        (referenceForm!.querySelector<HTMLElement>('[role="combobox"]') ?? reference!).focus();
      },
    },
    undo: {
      run: () => editor.chain().focus().undo().run(),
      enabled: () => editor.can().undo(),
    },
    redo: {
      run: () => editor.chain().focus().redo().run(),
      enabled: () => editor.can().redo(),
    },
  };

  const updateToolbar = () => {
    for (const button of toolbar.querySelectorAll<HTMLButtonElement>("[data-command]")) {
      const command = commands[button.dataset.command!];
      if (command.active) button.setAttribute("aria-pressed", String(command.active()));
      if (command.enabled) button.disabled = !command.enabled();
    }
  };

  const isLinkAddress = (href: string) => {
    try {
      return ["http:", "https:", "mailto:"].includes(new URL(href, location.origin).protocol);
    } catch {
      return false;
    }
  };
  const applyLink = () => {
    const href = linkUrl.value.trim();
    linkUrl.setCustomValidity(href && isLinkAddress(href) ? "" : root.dataset.invalidLinkMessage!);
    if (!linkUrl.reportValidity()) return;
    editor.chain().focus().extendMarkRange("link").setLink({ href }).run();
    closeForms();
  };
  const removeLink = () => {
    editor.chain().focus().extendMarkRange("link").unsetLink().run();
    closeForms();
  };
  // Links the selected text to the picked entity, or inserts the entity's name as a link.
  const linkEntity = () => {
    const entity = reference!.selectedOptions[0];
    if (!entity.value) return;

    const href = `/entities/${entity.value}`;
    const chain = editor.chain().focus();
    if (!editor.state.selection.empty || editor.isActive("link")) {
      chain.extendMarkRange("link").setLink({ href }).run();
    } else {
      chain
        .insertContent({ type: "text", text: entity.label, marks: [{ type: "link", attrs: { href } }] })
        // Text typed after the name is not part of the link.
        .unsetMark("link")
        .run();
    }

    // Tom Select keeps its instance on the select it enhances.
    (reference as HTMLSelectElement & { tomselect: TomSelect }).tomselect.setValue("", true);
    closeForms();
  };

  // Keeps the text selection while a toolbar button is clicked.
  toolbar.addEventListener("mousedown", (event) => event.preventDefault());
  toolbar.addEventListener("click", (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-command]");
    if (button) commands[button.dataset.command!].run();
  });
  root.querySelector("[data-link-apply]")!.addEventListener("click", applyLink);
  root.querySelector("[data-link-remove]")!.addEventListener("click", removeLink);
  root.querySelector("[data-link-cancel]")!.addEventListener("click", closeForms);
  root.querySelector("[data-reference-cancel]")?.addEventListener("click", closeForms);
  reference?.addEventListener("change", linkEntity);
  linkUrl.addEventListener("input", () => linkUrl.setCustomValidity(""));
  linkUrl.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== "Escape") return;
    event.preventDefault();
    if (event.key === "Enter") applyLink();
    else closeForms();
  });

  editor.on("transaction", updateToolbar);
  updateToolbar();
  toolbar.hidden = false;
  status.textContent = "";
  root.dataset.editorReady = "true";
  root.dispatchEvent(new Event("rich-text:ready", { bubbles: true }));
}
