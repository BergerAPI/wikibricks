import assert from "node:assert/strict";
import { test } from "node:test";
import { renderMarkdown } from "../markdown";

test("renders description formatting on the server", () => {
  const html = renderMarkdown(
    "## Building\n\n**Bricks** and *plates* with [instructions](/entities/1).\n\n- Red\n- Blue\n\n1. Build\n2. Play\n\n> A quote\n\n`code` and ~~removed~~",
  );
  for (const tag of [
    "h2",
    "strong",
    "em",
    "ul",
    "ol",
    "blockquote",
    "code",
    "s",
  ])
    assert.match(html, new RegExp(`<${tag}[ >]`));
  assert.match(html, /href="\/entities\/1"/);
});

test("keeps existing plain descriptions and line breaks readable", () => {
  assert.equal(
    renderMarkdown("First line\nSecond line\n\nNext paragraph"),
    "<p>First line<br>\nSecond line</p>\n<p>Next paragraph</p>\n",
  );
  assert.equal(renderMarkdown(""), "");
});

test("does not execute HTML embedded in descriptions", () => {
  const html = renderMarkdown(
    '<script>alert(1)</script>\n\n<img src=x onerror="alert(1)">\n\n<svg onload="alert(1)"></svg>',
  );
  assert.doesNotMatch(html, /<(script|img|svg)\b/);
  assert.match(html, /&lt;script&gt;/);
});

test("rejects executable links and external image embeds", () => {
  for (const url of [
    "javascript:alert(1)",
    "vbscript:alert(1)",
    "data:text/html,hello",
  ])
    assert.doesNotMatch(renderMarkdown(`[Click](${url})`), /<a\b/);
  assert.doesNotMatch(
    renderMarkdown("![tracking](https://example.com/pixel.png)"),
    /<img\b/,
  );
  assert.match(
    renderMarkdown("[Contact](mailto:hello@example.com)"),
    /href="mailto:hello@example.com"/,
  );
});
