import { CmsError, createCMS, defineBlock } from "@wikibricks/cms";
import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import type postgres from "postgres";
import { postgresAdapter } from "../src";
import { startDatabase } from "./database";

const projectList = defineBlock({
  slug: "projects",
  fields: {
    heading: { type: "text" },
    projects: { type: "relation", to: "project", many: true },
  },
});

const feature = defineBlock({
  slug: "feature",
  fields: { item: { type: "relation", to: ["project", "post"] } },
});

const collections = {
  tag: { title: "name", fields: { name: { type: "text", required: true } } },
  project: {
    title: "name",
    fields: {
      name: { type: "text", required: true },
      tags: { type: "relation", to: "tag", many: true },
    },
  },
  post: {
    title: "name",
    fields: {
      name: { type: "text", required: true },
      // Points at either a project or a post
      related: { type: "relation", to: ["project", "post"] },
    },
  },
  page: {
    title: "name",
    fields: {
      name: { type: "text", required: true },
      sections: { type: "blocks", blocks: [projectList, feature] },
    },
  },
} as const;

let sql: postgres.Sql;
let stop: () => Promise<void>;
let cms: ReturnType<typeof createCMS<typeof collections>>;
const ids: Record<string, number> = {};

const errorOf = (promise: Promise<unknown>) =>
  promise.then(
    () => assert.fail("expected an error"),
    (error: CmsError) => `${error.code} ${error.field ?? ""}`.trim(),
  );

const names = (result: { items: { title: string | null }[] }) => result.items.map((item) => item.title);

before(async () => {
  ({ sql, stop } = await startDatabase());
  cms = createCMS({ db: postgresAdapter({ sql }), collections, review: false });
  await cms.init();

  for (const name of ["web", "rust", "design"])
    ({ entityId: ids[name] } = await cms.create("tag", { values: { name } }));
  ({ entityId: ids.shop } = await cms.create("project", {
    values: { name: "Shop", tags: [ids.web, ids.design] },
  }));
  ({ entityId: ids.cli } = await cms.create("project", { values: { name: "CLI", tags: [ids.rust] } }));
});

after(() => stop());

describe("relations", () => {
  test("stores relations to many entries in order", async () => {
    assert.deepEqual((await cms.get(ids.shop, { type: "project" }))?.values.tags, [ids.web, ids.design]);

    const reordered = await cms.propose(ids.shop, { values: { tags: [ids.design, ids.web, ids.design] } });
    const shop = await cms.get(ids.shop, { type: "project", versionId: reordered });
    assert.deepEqual(shop?.values.tags, [ids.design, ids.web]);
  });

  test("carries relations over when they aren't changed", async () => {
    const renamed = await cms.propose(ids.cli, { values: { name: "Command line" } });
    assert.deepEqual((await cms.get(ids.cli, { type: "project", versionId: renamed }))?.values.tags, [ids.rust]);
  });

  test("only relates to entries of the given collections", async () => {
    assert.equal(
      await errorOf(cms.create("project", { values: { name: "Bad", tags: [ids.web, ids.shop] } })),
      "invalid tags.1",
    );
    assert.equal(
      await errorOf(cms.create("post", { values: { name: "Bad", related: ids.web } })),
      "invalid related",
    );

    const { entityId } = await cms.create("post", { values: { name: "Launch", related: ids.shop } });
    const reply = await cms.create("post", { values: { name: "Reply", related: entityId } });
    assert.equal((await cms.get(reply.entityId, { type: "post" }))?.values.related, entityId);
  });

  test("stores relations inside blocks", async () => {
    const sections = [
      { block: "projects", heading: "Work", projects: [ids.cli, ids.shop] },
      { block: "feature", item: ids.shop },
    ] as const;
    ({ entityId: ids.home } = await cms.create("page", { values: { name: "Home", sections } }));

    assert.deepEqual((await cms.get(ids.home, { type: "page" }))?.values.sections, sections);
  });

  test("finds entries by the entries they relate to", async () => {
    assert.deepEqual(names(await cms.find({ type: "project", where: { tags: ids.web } })), ["Shop"]);
    assert.deepEqual(
      names(await cms.find({ type: "project", where: { tags: { in: [ids.rust, ids.web] } }, sort: "title" })),
      ["Command line", "Shop"],
    );

    const { entityId } = await cms.create("project", { values: { name: "Untagged" } });
    assert.deepEqual(names(await cms.find({ type: "project", where: { tags: { exists: false } } })), [
      "Untagged",
    ]);
    assert.equal(
      await errorOf(cms.find({ type: "project", where: { tags: { gt: 1 } } })),
      "invalid tags.gt",
    );
    assert.equal(await errorOf(cms.find({ type: "project", sort: "tags" })), "invalid tags");
    await cms.propose(entityId, { values: { tags: [ids.web] } });
  });

  test("lists the entries pointing at an entry", async () => {
    const references = await cms.referencing(ids.shop);
    assert.deepEqual(
      references.map((reference) => `${reference.type}:${reference.title}:${reference.field}`),
      ["page:Home:sections", "post:Launch:related"],
    );
    assert.deepEqual(
      (await cms.referencing(ids.web)).map((reference) => reference.title),
      ["Shop", "Untagged"],
    );
  });

  test("drops relations to deleted entries", async () => {
    // Rejecting the first version of an entry deletes it, which needs review
    const reviewed = createCMS({ db: postgresAdapter({ sql }), collections, review: true });
    const draft = await reviewed.create("tag", { values: { name: "draft" } });
    const { entityId } = await cms.create("project", {
      values: { name: "Drafty", tags: [draft.entityId, ids.web] },
    });

    await reviewed.review(draft.entityId, draft.versionId, { status: "rejected" });
    assert.deepEqual((await cms.get(entityId, { type: "project" }))?.values.tags, [ids.web]);
  });
});

describe("populate", () => {
  test("replaces relations with the entries they point to", async () => {
    const shop = await cms.get(ids.shop, { type: "project", populate: true });
    assert.deepEqual(
      shop?.values.tags.map((tag) => tag.values.name),
      ["design", "web"],
    );

    const { entityId } = await cms.create("post", { values: { name: "Case study", related: ids.shop } });
    const post = await cms.get(entityId, { type: "post", populate: true });
    assert.equal(post?.values.related?.title, "Shop");
    // Only one level deep: the shop's own relations stay IDs
    assert.deepEqual(post?.values.related?.values, (await cms.get(ids.shop))?.values);
  });

  test("replaces relations inside blocks", async () => {
    const home = await cms.get(ids.home, { type: "page", populate: true });
    const [list, feature] = home?.values.sections ?? [];

    assert.equal(list.block, "projects");
    assert.deepEqual(list.block === "projects" && list.projects.map((project) => project.title), [
      "Command line",
      "Shop",
    ]);
    assert.equal(feature.block === "feature" && feature.item?.title, "Shop");
  });

  test("populates found entries and leaves out missing ones", async () => {
    const { entityId: lone } = await cms.create("tag", { values: { name: "lone" } });
    const { entityId } = await cms.create("project", { values: { name: "Lonely", tags: [lone, ids.rust] } });
    await cms.delete(lone);

    const { items } = await cms.find({ type: "project", where: { id: entityId }, populate: true });
    assert.deepEqual(
      items[0].values.tags.map((tag) => tag.title),
      ["rust"],
    );
  });
});

describe("delete", () => {
  test("deletes an entry with its versions and returns it", async () => {
    const { entityId } = await cms.create("tag", { values: { name: "temporary" } });
    await cms.propose(entityId, { values: { name: "temporary tag" } });

    const deleted = await cms.delete(entityId);
    assert.equal(deleted.title, "temporary tag");
    assert.equal(await cms.get(entityId), undefined);
    assert.equal(await cms.history(entityId), undefined);
    assert.equal(await errorOf(cms.delete(entityId)), "not_found");
  });

  test("deletes entries that were never approved", async () => {
    const reviewed = createCMS({ db: postgresAdapter({ sql }), collections, review: true });
    const { entityId } = await reviewed.create("tag", { values: { name: "unapproved" } });

    assert.equal((await reviewed.delete(entityId)).title, "unapproved");
  });

  test("clears relations to the deleted entry", async () => {
    const { entityId: target } = await cms.create("project", { values: { name: "Gone soon" } });
    const { entityId } = await cms.create("post", { values: { name: "Pointer", related: target } });

    await cms.delete(target);
    assert.equal((await cms.get(entityId, { type: "post" }))?.values.related, null);
  });
});
