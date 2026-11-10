import assert from "node:assert/strict";
import { test } from "node:test";
import { RichText, RichTextEditor } from "../components/rich-text";
import type { TranslationFunctions } from "../translation";

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
  assert.match(html, /role="group"/);
});
