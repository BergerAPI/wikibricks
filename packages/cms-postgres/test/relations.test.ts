import { CmsError, createCMS, type Block } from "@wikibricks/cms";
import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import type postgres from "postgres";
import { postgresAdapter } from "../src";
import { startDatabase } from "./database";

const projectList = {
  slug: "projects",
  fields: {
    heading: { type: "text" },
    projects: { type: "relation", to: "project", many: true },
  },
} satisfies Block;

const feature = {
  slug: "feature",
  fields: { item: { type: "relation", to: ["project", "post"] } },
} satisfies Block;

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
    assert.deepEqual((await cms.get(ids.shop))?.values.tags, [ids.web, ids.design]);

    const reordered = await cms.propose(ids.shop, { values: { tags: [ids.design, ids.web, ids.design] } });
    assert.deepEqual((await cms.get(ids.shop, reordered))?.values.tags, [ids.design, ids.web]);
  });

  test("carries relations over when they aren't changed", async () => {
    const renamed = await cms.propose(ids.cli, { values: { name: "Command line" } });
    assert.deepEqual((await cms.get(ids.cli, renamed))?.values.tags, [ids.rust]);
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
    assert.equal((await cms.get(reply.entityId))?.values.related, entityId);
  });

  test("stores relations inside blocks", async () => {
    const sections = [
      { block: "projects", heading: "Work", projects: [ids.cli, ids.shop] },
      { block: "feature", item: ids.shop },
    ];
    ({ entityId: ids.home } = await cms.create("page", { values: { name: "Home", sections } }));

    assert.deepEqual((await cms.get(ids.home))?.values.sections, sections);
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
    assert.deepEqual((await cms.get(entityId))?.values.tags, [ids.web]);
  });
});
