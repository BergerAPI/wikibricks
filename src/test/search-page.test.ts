import assert from "node:assert/strict";
import { test } from "node:test";
import type { FindQuery } from "@wikibricks/cms";
import { Hono } from "hono";
import { cms } from "../collections";
import { handleSearchPage } from "../routes/entities/search";

test("returns a filtered set search to the first page when its offset exceeds the matches", async (context) => {
  const find = context.mock.method(cms, "find", async (query: FindQuery) => ({
    total: query.type === "set" ? 4 : 0,
    items: [],
  }));
  const app = new Hono().get("/entities/search", handleSearchPage);
  const response = await app.request("/entities/search?entity_type=set&filter.pieces.min=100&page=1");

  assert.equal(response.status, 302);
  const location = new URL(response.headers.get("location")!, "http://localhost");
  assert.equal(location.searchParams.get("entity_type"), "set");
  assert.equal(location.searchParams.get("filter.pieces.min"), "100");
  assert.ok(!location.searchParams.has("page"));
  const query = find.mock.calls.find(({ arguments: [query] }) => query?.type === "set")?.arguments[0];
  assert.deepEqual(query?.where, { and: [{}, { pieces: { gte: 100 } }] });
});
