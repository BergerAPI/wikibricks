import {
  MarkdownSerializer,
  defaultMarkdownSerializer,
} from "prosemirror-markdown";
import type { Node } from "@tiptap/pm/model";

const nodes = defaultMarkdownSerializer.nodes;
const marks = defaultMarkdownSerializer.marks;
const serializer = new MarkdownSerializer(
  {
    blockquote: nodes.blockquote,
    codeBlock(state, node) {
      const backticks = node.textContent.match(/`+/g) ?? [];
      const fence = "`".repeat(
        Math.max(3, ...backticks.map((run) => run.length + 1)),
      );
      state.write(`${fence}${node.attrs.language ?? ""}\n`);
      state.text(node.textContent, false);
      state.ensureNewLine();
      state.write(fence);
      state.closeBlock(node);
    },
    heading: nodes.heading,
    horizontalRule: nodes.horizontal_rule,
    bulletList: nodes.bullet_list,
    orderedList(state, node) {
      const start = node.attrs.start ?? 1;
      const width = String(start + node.childCount - 1).length;
      state.renderList(
        node,
        " ".repeat(width + 2),
        (index) => `${String(start + index).padStart(width)}. `,
      );
    },
    listItem: nodes.list_item,
    paragraph(state, node) {
      if (node.childCount) state.renderInline(node);
      else state.write("&nbsp;");
      state.closeBlock(node);
    },
    hardBreak: nodes.hard_break,
    text: nodes.text,
  },
  {
    bold: marks.strong,
    italic: marks.em,
    code: marks.code,
    link: {
      open: "[",
      close: (_state, mark) => {
        const href = mark.attrs.href
          .replace(/[\s<>]/g, encodeURIComponent)
          .replaceAll("&", "&amp;")
          .replace(/[()\\"]/g, "\\$&");
        const title = mark.attrs.title
          ? ` "${mark.attrs.title.replace(/[\\"]/g, "\\$&")}"`
          : "";
        return `](${href}${title})`;
      },
      mixable: true,
    },
    strike: {
      open: "~~",
      close: "~~",
      mixable: true,
      expelEnclosingWhitespace: true,
    },
  },
  { hardBreakNodeName: "hardBreak", escapeExtraCharacters: /[&<>]/g },
);

export const serializeMarkdown = (document: Node) =>
  serializer.serialize(document);
