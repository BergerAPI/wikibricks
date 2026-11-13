import assert from "node:assert/strict";
import test from "node:test";
import { entityPath, parseEntityId, slugify } from "../urls";

test("turns names into readable address parts", () => {
  assert.equal(slugify("Farm House"), "farm-house");
  assert.equal(slugify("Größe & Maße – Übersicht!"), "groesse-masse-uebersicht");
  assert.equal(slugify("Café Crème"), "cafe-creme");
  assert.equal(slugify("レゴ"), "");
  assert.ok(slugify("a ".repeat(100)).length <= 80);
});

test("builds entity paths with and without a usable name", () => {
  assert.equal(entityPath({ entityId: 12, title: "Farm House" }), "/entities/12-farm-house");
  assert.equal(entityPath({ entityId: 12, title: "レゴ" }), "/entities/12");
  assert.equal(entityPath({ entityId: 12, title: null }), "/entities/12");
});

test("reads the entity ID whatever name follows it", () => {
  assert.equal(parseEntityId("12"), 12);
  assert.equal(parseEntityId("12-farm-house"), 12);
  assert.equal(parseEntityId("12-2024-edition"), 12);
  // Beyond the range of database IDs nothing can be found
  for (const value of ["", "0", "farm-house", "12farm", "-12", "1.5", "2147483648"]) {
    assert.equal(parseEntityId(value), undefined);
  }
});
