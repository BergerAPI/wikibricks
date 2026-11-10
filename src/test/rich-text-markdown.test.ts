import assert from "node:assert/strict";
import { test } from "node:test";
import { getSchema } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { serializeMarkdown } from "../components/rich-text/markdown";
import { renderMarkdown } from "../markdown";

const schema = getSchema([
  StarterKit.configure({ underline: false, trailingNode: false }),
]);
const paragraph = (text = "") => ({
  type: "paragraph",
  content: text ? [{ type: "text", text }] : [],
});
const serialize = (content: unknown[]) =>
  serializeMarkdown(schema.nodeFromJSON({ type: "doc", content }));

test("keeps pasted Markdown syntax as literal paragraph text", () => {
  for (const text of [
    "# literal",
    "1. literal",
    "---",
    "+ literal",
    "> literal",
    "Set [42]",
    "**literal**",
    "<script>alert(1)</script>",
  ]) {
    const html = renderMarkdown(serialize([paragraph(text)]));
    assert.match(html, /^<p>/);
    assert.doesNotMatch(html, /<(h[1-6]|ol|ul|hr|blockquote|strong|script)\b/);
  }
});

test("keeps link destinations with spaces and parentheses", () => {
  for (const href of [
    "https://example.com/a b",
    "https://example.com/path)tail",
    "/entities/1",
  ]) {
    const markdown = serialize([
      {
        type: "paragraph",
        content: [
          {
            type: "text",
            text: "Link",
            marks: [{ type: "link", attrs: { href } }],
          },
        ],
      },
    ]);
    assert.equal(
      renderMarkdown(markdown),
      `<p><a href="${href.replaceAll(" ", "%20")}">Link</a></p>\n`,
    );
  }
});

test("keeps literal entities and autolink-shaped text unchanged", () => {
  for (const text of ["&copy;", "&#65;", "<https://example.com>"]) {
    const html = renderMarkdown(serialize([paragraph(text)]));
    const escaped = text
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;");
    assert.equal(html, `<p>${escaped}</p>\n`);
  }
});

test("preserves literal entities and angle brackets in link destinations", () => {
  const href = "https://example.com/a<b>?x=&copy;";
  const markdown = serialize([
    {
      type: "paragraph",
      content: [
        {
          type: "text",
          text: "Link",
          marks: [{ type: "link", attrs: { href } }],
        },
      ],
    },
  ]);
  assert.equal(
    renderMarkdown(markdown),
    '<p><a href="https://example.com/a%3Cb%3E?x=&amp;copy;">Link</a></p>\n',
  );
});

test("preserves explicit blank paragraphs and hard line breaks", () => {
  const html = renderMarkdown(
    serialize([
      paragraph("First"),
      paragraph(),
      paragraph("Next"),
      {
        type: "paragraph",
        content: [
          { type: "text", text: "Line" },
          { type: "hardBreak" },
          { type: "text", text: "Break" },
        ],
      },
    ]),
  );
  assert.match(html, /<p>First<\/p>\n<p>\u00a0<\/p>\n<p>Next<\/p>/);
  assert.match(html, /Line<br>\nBreak/);
});

test("serializes the Tiptap nodes and marks used by the editor", () => {
  const html = renderMarkdown(
    serialize([
      {
        type: "heading",
        attrs: { level: 2 },
        content: [{ type: "text", text: "Heading" }],
      },
      {
        type: "bulletList",
        content: [{ type: "listItem", content: [paragraph("Item")] }],
      },
      {
        type: "orderedList",
        attrs: { start: 3 },
        content: [{ type: "listItem", content: [paragraph("Third")] }],
      },
      { type: "blockquote", content: [paragraph("Quote")] },
      { type: "horizontalRule" },
      {
        type: "codeBlock",
        attrs: { language: "js" },
        content: [{ type: "text", text: "const x = 1;" }],
      },
      {
        type: "paragraph",
        content: [
          { type: "text", text: "Bold", marks: [{ type: "bold" }] },
          { type: "text", text: "Italic", marks: [{ type: "italic" }] },
          { type: "text", text: "Strike", marks: [{ type: "strike" }] },
          { type: "text", text: "Code", marks: [{ type: "code" }] },
        ],
      },
    ]),
  );
  for (const tag of [
    "h2",
    "ul",
    "ol",
    "blockquote",
    "hr",
    "pre",
    "strong",
    "em",
    "s",
    "code",
  ])
    assert.match(html, new RegExp(`<${tag}[ >]`));
  assert.match(html, /<ol start="3">/);
  assert.match(html, /<code class="language-js">/);
});
