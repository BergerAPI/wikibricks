import assert from "node:assert/strict";
import { afterEach, mock, test } from "node:test";
import type { FindQuery } from "@wikibricks/cms";
import { Hono } from "hono";
import { cms } from "../collections";
import { loadFieldOptions } from "../fields";
import { handleEntityOptions, handleRelationOptions } from "../routes/entities/options";
import type { SelectOptionsResponse } from "../shared/contracts";

afterEach(() => mock.restoreAll());

const entries = (count: number) => Array.from({ length: count }, (_, index) => ({
  entityId: index + 1, title: `Choice ${index + 1}`,
}));

test("keeps a select for small relation collections, including the threshold", async () => {
  mock.method(cms, "find", async () => ({ total: 40, items: entries(40) }));
  const options = (await loadFieldOptions("set")).brand_id;
  assert.equal(options.items.length, 40);
  assert.equal(options.lookupUrl, undefined);
});

test("uses remote lookup for large collections and loads a selected value outside the first page", async () => {
  const find = mock.method(cms, "find", async (query: FindQuery) =>
    query.where?.id === 99
      ? { total: 1, items: [{ entityId: 99, title: "Selected choice" }] }
      : { total: 1000, items: entries(40) },
  );
  const options = (await loadFieldOptions("set", { brand_id: 99 })).brand_id;
  assert.equal(options.lookupUrl, "/entities/options/set/brand_id");
  assert.deepEqual(options.items.map(({ value, label }) => ({ value, label })), [
    { value: "99", label: "Selected choice" },
  ]);
  assert.ok(find.mock.calls.every(({ arguments: [query] }) => (query?.limit ?? Infinity) <= 40));
});

test("does not serialize the first page into an unselected large picker", async () => {
  mock.method(cms, "find", async () => ({ total: 1000, items: entries(40) }));
  const options = (await loadFieldOptions("set")).brand_id;
  assert.deepEqual(options.items, []);
  assert.ok(options.lookupUrl);
});

test("keeps CMS select options as ordinary selects", async () => {
  const find = mock.method(cms, "find", async () => ({ total: 0, items: [] }));
  const options = (await loadFieldOptions("set")).theme;
  assert.deepEqual(options.items.find((option) => option.value === "lego-nature-farm"), {
    value: "lego-nature-farm", label: "Bauernhof", group: "Lego / Natur",
  });
  assert.equal(options.lookupUrl, undefined);
  assert.equal(find.mock.callCount(), 1);
});

test("looks up bounded suggestions using the CMS relation's targets", async () => {
  const find = mock.method(cms, "find", async () => ({ total: 55, items: entries(20) }));
  const app = new Hono().get("/entities/options/:type/:field", handleRelationOptions);
  const response = await app.request("/entities/options/set/brand_id?q=Choice");
  assert.equal(response.status, 200);
  const body = await response.json() as SelectOptionsResponse;
  assert.equal(body.options.length, 20);
  assert.equal(body.more, true);
  const query = find.mock.calls[0].arguments[0]!;
  assert.deepEqual(query.where, { type: { in: ["brand"] }, title: { contains: "Choice" } });
  assert.equal(query.limit, 20);
});

test("only exposes options for defined relation fields", async () => {
  const find = mock.method(cms, "find", async () => ({ total: 0, items: [] }));
  const app = new Hono().get("/entities/options/:type/:field", handleRelationOptions);
  for (const path of ["unknown/brand_id", "set/unknown", "set/pieces"])
    assert.equal((await app.request(`/entities/options/${path}`)).status, 404);
  assert.equal(find.mock.callCount(), 0);
});

test("searches all CMS entity types for editor references with bounded, grouped results", async () => {
  const find = mock.method(cms, "find", async () => ({ total: 55, items: [
    { entityId: 2, title: "Cobi", type: "brand" },
    { entityId: 6, title: "City Bus", type: "set" },
  ] }));
  const app = new Hono().get("/entities/options", handleEntityOptions);
  const response = await app.request("/entities/options?q=Ci");
  assert.equal(response.status, 200);
  const body = await response.json() as SelectOptionsResponse;
  assert.deepEqual(body.options, [
    { value: "2", label: "Cobi", group: "Brand" },
    { value: "6", label: "City Bus", group: "Set" },
  ]);
  assert.equal(body.more, true);
  const query = find.mock.calls[0].arguments[0]!;
  assert.deepEqual(query.where, { title: { contains: "Ci" } });
  assert.equal(query.limit, 20);
});
