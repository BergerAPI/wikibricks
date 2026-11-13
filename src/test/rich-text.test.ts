import assert from "node:assert/strict";
import { test } from "node:test";
import { RichText, RichTextEditor } from "../components/rich-text";
import type { TranslationFunctions } from "../translation";

test("review descriptions highlight changed words within the rendered text", () => {
  const html = String(RichText({
    previous: { value: "## Unchanged heading\n\nBuild a red castle.\n\n**Shared formatting**", t },
    value: "## Unchanged heading\n\nBuild a blue castle.\n\n**Shared formatting**",
  }));
  assert.match(html, /Build a <del[^>]*><span[^>]*>review.before <\/span>red<\/del><ins[^>]*><span[^>]*>review.after <\/span>blue<\/ins> castle\./);
  assert.equal((html.match(/<h2>Unchanged heading<\/h2>/g) ?? []).length, 1);
  assert.equal((html.match(/<strong>Shared formatting<\/strong>/g) ?? []).length, 1);
});

test("review highlights edits in adjacent formatted paragraphs without duplicating the shared words", () => {
  const html = String(RichText({
    previous: { value: "Build a **red** castle.\n\nAdd a *small* tower.", t },
    value: "Build a **blue** castle.\n\nAdd a *tall* tower.",
  }));
  assert.match(html, /<strong><del[^>]*>[^]*?red<\/del><ins[^>]*>[^]*?blue<\/ins><\/strong>/);
  assert.match(html, /<em><del[^>]*>[^]*?small<\/del><ins[^>]*>[^]*?tall<\/ins><\/em>/);
  assert.equal((html.match(/Build a/g) ?? []).length, 1);
});

const t: TranslationFunctions["t"] = (key) => key;

test("renders formatted descriptions without loading editor code", () => {
  const html = String(RichText({ value: "**Bricks** and *plates*" }));
  assert.match(html, /<strong>Bricks<\/strong>/);
  assert.doesNotMatch(
    html,
    /data-include-script|contenteditable|<script|\*\*Bricks/,
  );
});

test("keeps Markdown in a hidden form value and renders the editor content on the server", () => {
  const value = '**Bricks** <script>alert("x")</script>';
  const html = String(
    RichTextEditor({ id: "description", name: "description", value, t }),
  );
  assert.match(html, /data-include-script="components\/rich-text"/);
  assert.match(html, /<input[^>]*type="hidden"[^>]*name="description"/);
  assert.match(html, /<strong>Bricks<\/strong>/);
  assert.doesNotMatch(html, /<textarea|<script|contenteditable/);
  assert.match(html, /role="toolbar"/);
  // Without a lookup there is nothing to link entries with
  assert.doesNotMatch(html, /data-command="entity"|data-reference-form/);
  assert.match(String(RichTextEditor({ id: "d", name: "d", value: "", t, referenceUrl: "/entities/options" })), /data-command="entity"/);
});
