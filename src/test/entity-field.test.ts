import assert from "node:assert/strict";
import { test } from "node:test";
import { EntityFieldInput } from "../components/entity-field";
import type { TranslationFunctions } from "../translation";

const t: TranslationFunctions["t"] = (key) => key;

test("declares the shared script and preserves a native form control before enhancement", () => {
  const html = String(EntityFieldInput({
    field: { type: "relation", to: "brand", meta: { label: "entity.brand" } },
    options: { lookupUrl: "/entities/options/set/brand_id", items: [
      { value: "99", label: "A brand" },
    ] },
    value: "99", id: "brand", name: "brand_id", t,
  }));
  assert.match(html, /data-include-script="components\/select"/);
  assert.match(html, /data-options-url="\/entities\/options\/set\/brand_id"/);
  assert.match(html, /<select[^>]*name="brand_id"/);
  assert.match(html, /<option value="99" selected="">A brand<\/option>/);
  assert.ok(!html.includes("<datalist"));
  assert.ok(!html.includes("(#99)"));
});

test("uses real option groups for hierarchical CMS choices", () => {
  const html = String(EntityFieldInput({
    field: { type: "select", options: ["leaf"], meta: {} }, value: "leaf", t,
    options: { items: [
      { value: "leaf", label: "Leaf", group: "Root / Child" },
    ] },
  }));
  assert.match(html, /<optgroup label="Root \/ Child">/);
  assert.match(html, /<option value="leaf" selected="">Leaf<\/option>/);
  assert.ok(!html.includes("bg-neutral"));
  assert.ok(!html.includes("disabled"));
});
