import assert from "node:assert/strict";
import { test } from "node:test";
import type { Field } from "@wikibricks/cms";
import type { FieldUi } from "../collections";
import { readSearchFilters, searchableFields } from "../search-filters";

// Names deliberately differ from the wiki's collections: filters follow the field definitions.
const fields: Record<string, Field<FieldUi>> = {
  name: { type: "text", meta: {} },
  notes: { type: "text", meta: { label: "entities.descriptionLabel" } },
  weight: { type: "number", meta: { label: "entity.pieces" } },
  category: { type: "select", options: ["small", "large"], meta: { label: "entity.size" } },
  owner: { type: "relation", to: "anything", meta: { label: "entity.brand" } },
  nested: { type: "array", fields: {}, meta: { label: "entity.theme" } },
};

test("derives searchable fields from labelled CMS scalar fields", () => {
  assert.deepEqual(Object.keys(searchableFields(fields)), ["notes", "weight", "category", "owner"]);
});

test("combines text, numeric ranges, selections and relations", () => {
  const filters = readSearchFilters(searchableFields(fields), new URLSearchParams({
    "filter.notes": "Hello",
    "filter.weight.min": "0",
    "filter.weight.max": "500",
    "filter.category": "large",
    "filter.owner": "42",
  }));
  assert.deepEqual(filters.where, {
    notes: { contains: "Hello" },
    weight: { gte: 0, lte: 500 },
    category: "large",
    owner: 42,
  });
  assert.equal(filters.params.get("filter.weight.min"), "0");
  assert.equal(filters.params.get("filter.owner"), "42");
});

test("ignores empty and unrelated query parameters", () => {
  const filters = readSearchFilters(searchableFields(fields), new URLSearchParams({
    "filter.notes": "   ",
    "filter.weight.min": "",
    "filter.unknown": "anything",
    "filter.name": "hidden field",
    "filter.nested": "unsupported",
    page: "2",
  }));
  assert.deepEqual(filters.where, {});
  assert.equal(filters.params.size, 0);
});

test("supports either end of a number range", () => {
  const filters = readSearchFilters(fields, new URLSearchParams({ "filter.weight.max": "12" }));
  assert.deepEqual(filters.where, { weight: { lte: 12 } });
});

test("rejects invalid numeric, relation and select values before querying Postgres", () => {
  const cases: Record<string, string>[] = [
    { "filter.weight.min": "oops" },
    { "filter.weight.min": "1.5" },
    { "filter.weight.max": "999999999999999999999" },
    { "filter.owner": "not-an-id" },
    { "filter.category": "unknown" },
  ];
  for (const params of cases)
    assert.throws(() => readSearchFilters(fields, new URLSearchParams(params)), /Invalid search filter/);
});

test("supports boolean and date fields added to a CMS collection", () => {
  const extra: Record<string, Field<FieldUi>> = {
    active: { type: "boolean", meta: { label: "entity.size" } },
    published: { type: "date", meta: { label: "entity.issued" } },
  };
  assert.deepEqual(readSearchFilters(extra, new URLSearchParams({
    "filter.active": "false", "filter.published": "2026-11-09",
  })).where, { active: false, published: "2026-11-09" });
  for (const query of ["filter.active=maybe", "filter.published=not-a-date", "filter.published=2026-02-31"])
    assert.throws(() => readSearchFilters(extra, new URLSearchParams(query)), /Invalid search filter/);
});
