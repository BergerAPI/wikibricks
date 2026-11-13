import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import type TomSelect from "tom-select/base";
import { serializeMarkdown } from "./markdown";

type Command = { run: () => void; active?: () => boolean; enabled?: () => boolean };

const isMac = /Mac|iPhone|iPad/.test(navigator.platform);

export default function mount(root: HTMLElement) {
  const find = <T extends HTMLElement>(selector: string) => root.querySelector<T>(selector);
  const value = find<HTMLInputElement>("[data-rich-text-value]")!;
  const content = find("[data-editor-content]")!;
  const toolbar = find("[data-editor-toolbar]")!;
  const blockType = find<HTMLSelectElement>("[data-block-type]")!;
  const linkInfo = find("[data-link-info]")!;
  const linkOpen = find<HTMLAnchorElement>("[data-link-open]")!;
  const linkForm = find("[data-link-form]")!;
  const linkText = find<HTMLInputElement>("[data-link-text]")!;
  const linkTextLabel = find("[data-link-text-label]")!;
  const linkUrl = find<HTMLInputElement>("[data-link-url]")!;
  const status = find("[data-script-status]")!;
  const characterCount = find("[data-character-count]")!;
  // Only editors that can link entities have the reference form.
  const referenceForm = find("[data-reference-form]");
  const reference = find<HTMLSelectElement>("[data-reference-select]");
  const maxLength = Number(root.dataset.maxLength);

  // Start from the same safe, server-rendered HTML that readers see.
  const initialHtml = content.innerHTML;
  content.replaceChildren();
  content.style.setProperty("--placeholder", JSON.stringify(root.dataset.placeholder ?? ""));

  const editor = new Editor({
    element: content,
    content: initialHtml,
    extensions: [
      StarterKit.configure({
        underline: false,
        trailingNode: false,
        link: { openOnClick: false, autolink: true, defaultProtocol: "https", HTMLAttributes: { target: null } },
      }),
    ],
    editorProps: {
      attributes: {
        class: "prose max-w-none min-h-48 prose-headings:font-serif prose-a:text-blue-800 focus:outline-none",
        role: "textbox",
        "aria-label": root.dataset.label!,
        "aria-multiline": "true",
      },
      handleKeyDown: (_view, event) => {
        if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
          event.preventDefault();
          commands.link.run();
          return true;
        }
        return false;
      },
      // Typing [[ searches for an entry to link
      handleTextInput: (view, from, to, text) => {
        if (!referenceForm || text !== "[" || view.state.doc.textBetween(Math.max(0, from - 1), from) !== "[") return false;
        editor.chain().deleteRange({ from: from - 1, to }).run();
        commands.entity.run();
        return true;
      },
    },
    // Only edits update the value, so opening the editor never rewrites the stored Markdown.
    onUpdate: ({ editor }) => {
      value.value = editor.isEmpty ? "" : serializeMarkdown(editor.state.doc);
      value.dispatchEvent(new Event("input", { bubbles: true }));
      updateCount();
    },
  });

  const forms = [linkForm, referenceForm].filter((form) => form !== null);
  const showForm = (form: HTMLElement | null) => {
    for (const each of forms) each.hidden = each !== form;
    linkUrl.setCustomValidity("");
    updateLinkInfo();
  };
  const closeForms = () => {
    showForm(null);
    editor.commands.focus();
  };

  const toggle = (name: string, run: () => void, attributes?: Record<string, unknown>): Command => ({
    run,
    active: () => editor.isActive(name, attributes),
  });

  const commands: Record<string, Command> = {
    bold: toggle("bold", () => editor.chain().focus().toggleBold().run()),
    italic: toggle("italic", () => editor.chain().focus().toggleItalic().run()),
    strike: toggle("strike", () => editor.chain().focus().toggleStrike().run()),
    code: toggle("code", () => editor.chain().focus().toggleCode().run()),
    bulletList: toggle("bulletList", () => editor.chain().focus().toggleBulletList().run()),
    orderedList: toggle("orderedList", () => editor.chain().focus().toggleOrderedList().run()),
    blockquote: toggle("blockquote", () => editor.chain().focus().toggleBlockquote().run()),
    link: {
      run: () => {
        // Without a selection the link needs a text of its own
        const { empty, from, to } = editor.state.selection;
        const inLink = editor.isActive("link");
        linkTextLabel.hidden = !empty || inLink;
        linkText.value = editor.state.doc.textBetween(from, to);
        linkUrl.value = editor.getAttributes("link").href ?? "";
        showForm(linkForm);
        (linkTextLabel.hidden ? linkUrl : linkText).focus();
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
    horizontalRule: { run: () => editor.chain().focus().setHorizontalRule().run() },
    undo: {
      run: () => editor.chain().focus().undo().run(),
      enabled: () => editor.can().undo(),
    },
    redo: {
      run: () => editor.chain().focus().redo().run(),
      enabled: () => editor.can().redo(),
    },
  };

  const blockCommands: Record<string, Command> = {
    paragraph: toggle("paragraph", () => editor.chain().focus().setParagraph().run()),
    heading: toggle("heading", () => editor.chain().focus().setHeading({ level: 2 }).run(), { level: 2 }),
    subheading: toggle("heading", () => editor.chain().focus().setHeading({ level: 3 }).run(), { level: 3 }),
    codeBlock: toggle("codeBlock", () => editor.chain().focus().setCodeBlock().run()),
  };

  const updateToolbar = () => {
    for (const button of toolbar.querySelectorAll<HTMLButtonElement>("[data-command]")) {
      const command = commands[button.dataset.command!];
      if (command.active) button.setAttribute("aria-pressed", String(command.active()));
      if (command.enabled) button.disabled = !command.enabled();
    }
    blockType.value = Object.keys(blockCommands).find((type) => blockCommands[type].active!()) ?? "paragraph";
  };

  const updateLinkInfo = () => {
    const href = editor.isActive("link") ? editor.getAttributes("link").href : undefined;
    linkInfo.hidden = !href || forms.some((form) => !form.hidden);
    linkOpen.href = linkOpen.textContent = href ?? "";
  };

  const updateCount = () => {
    const length = value.value.length;
    characterCount.textContent = root.dataset.characters!
      .replace("{count}", length.toLocaleString())
      .replace("{max}", maxLength.toLocaleString());
    characterCount.classList.toggle("text-red-700", length > maxLength);
    characterCount.classList.toggle("font-semibold", length > maxLength);
  };

  const isLinkAddress = (href: string) => {
    try {
      return ["http:", "https:", "mailto:"].includes(new URL(href, location.origin).protocol);
    } catch {
      return false;
    }
  };
  // Addresses without a scheme, like example.com, are web addresses
  const completeAddress = (href: string) =>
    /^[a-z][a-z\d+.-]*:|^[/#?]/i.test(href) || !/^[^\s/]+\.[^\s/]+/.test(href) ? href : `https://${href}`;

  const applyLink = () => {
    const href = completeAddress(linkUrl.value.trim());
    linkUrl.setCustomValidity(href && isLinkAddress(href) ? "" : root.dataset.invalidLinkMessage!);
    if (!linkUrl.reportValidity()) return;

    const chain = editor.chain().focus();
    if (!linkTextLabel.hidden) {
      const text = linkText.value.trim() || href;
      chain.insertContent({ type: "text", text, marks: [{ type: "link", attrs: { href } }] }).unsetMark("link").run();
    } else {
      chain.extendMarkRange("link").setLink({ href }).run();
    }
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

  const modifier = isMac ? "⌘" : "Ctrl+";
  for (const button of toolbar.querySelectorAll<HTMLButtonElement>("[data-shortcut]")) {
    button.title = `${button.title} (${modifier}${button.dataset.shortcut})`;
  }

  // Keeps the text selection while a toolbar button is clicked.
  toolbar.addEventListener("mousedown", (event) => {
    if ((event.target as HTMLElement).closest("button")) event.preventDefault();
  });
  toolbar.addEventListener("click", (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-command]");
    if (button) commands[button.dataset.command!].run();
  });
  blockType.addEventListener("change", () => blockCommands[blockType.value].run());
  find("[data-link-apply]")!.addEventListener("click", applyLink);
  find("[data-link-edit]")!.addEventListener("click", commands.link.run);
  find("[data-link-remove]")!.addEventListener("click", removeLink);
  for (const button of root.querySelectorAll("[data-form-cancel]")) button.addEventListener("click", closeForms);
  reference?.addEventListener("change", linkEntity);
  linkUrl.addEventListener("input", () => linkUrl.setCustomValidity(""));
  // Listens before the entry search, which handles Escape itself
  for (const form of forms) {
    form.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        closeForms();
      } else if (event.key === "Enter" && form === linkForm) {
        event.preventDefault();
        applyLink();
      }
    }, true);
  }

  editor.on("transaction", () => {
    updateToolbar();
    updateLinkInfo();
    content.toggleAttribute("data-empty", editor.isEmpty);
  });
  updateToolbar();
  updateCount();
  content.toggleAttribute("data-empty", editor.isEmpty);
  toolbar.hidden = false;
  find("[data-editor-hint]")?.removeAttribute("hidden");
  status.textContent = "";
  root.dataset.editorReady = "true";
  root.dispatchEvent(new Event("rich-text:ready", { bubbles: true }));
}
