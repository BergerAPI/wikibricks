import { CmsError, createCMS } from "@wikibricks/cms";
import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import type postgres from "postgres";
import { postgresAdapter } from "../src";
import { startDatabase } from "./database";

const collections = {
  author: {
    title: "name",
    fields: {
      name: { type: "text", required: true, unique: true },
      active: { type: "boolean" },
    },
  },
  post: {
    title: "headline",
    fields: {
      headline: { type: "text", required: true },
      kind: { type: "select", options: ["news", "guide"] },
      views: { type: "number" },
      featured: { type: "boolean" },
      published: { type: "date" },
      updated: { type: "date", time: true },
      author: { type: "relation", to: "author" },
    },
  },
  draft: {
    title: "title",
    review: true,
    fields: { title: { type: "text", required: true, unique: true } },
  },
  note: {
    title: "text",
    versions: false,
    fields: { text: { type: "text" } },
  },
  settings: {
    singleton: true,
    fields: { site_name: { type: "text" } },
  },
} as const;

let sql: postgres.Sql;
let stop: () => Promise<void>;
let cms: ReturnType<typeof createCMS<typeof collections>>;
let ada: number;

const errorOf = (promise: Promise<unknown>) =>
  promise.then(
    () => assert.fail("expected an error"),
    (error: CmsError) => `${error.code} ${error.field ?? ""}`.trim(),
  );

const titles = (result: { items: { title: string | null }[] }) => result.items.map((item) => item.title);

before(async () => {
  ({ sql, stop } = await startDatabase());
  cms = createCMS({ db: postgresAdapter({ sql }), collections, review: false });
  await cms.init();

  ({ entityId: ada } = await cms.create("author", { values: { name: "Ada", active: true } }));
  await cms.create("author", { values: { name: "Grace", active: false } });

  const posts = [
    { headline: "Hello World", kind: "news", views: 5, featured: true, published: "2024-01-10" },
    { headline: "Getting started", kind: "guide", views: 50, featured: false, published: "2024-03-01" },
    { headline: "Deep dive", kind: "guide", views: 20, published: null },
    { headline: "Release notes", kind: "news", views: 12, featured: true, published: "2024-06-30" },
  ];
  for (const post of posts) await cms.create("post", { values: { ...post, author: ada } });
});

after(() => stop());

describe("find", () => {
  test("filters by values with operators", async () => {
    assert.deepEqual(titles(await cms.find({ type: "post", where: { views: { gt: 10 } }, sort: "views" })), [
      "Release notes",
      "Deep dive",
      "Getting started",
    ]);
    assert.deepEqual(titles(await cms.find({ type: "post", where: { kind: "news" }, sort: "title" })), [
      "Hello World",
      "Release notes",
    ]);
    assert.deepEqual(titles(await cms.find({ type: "post", where: { headline: { contains: "WORLD" } } })), [
      "Hello World",
    ]);
    assert.deepEqual(titles(await cms.find({ type: "post", where: { published: { exists: false } } })), [
      "Deep dive",
    ]);
    assert.deepEqual(
      titles(await cms.find({ type: "post", where: { featured: true, views: { in: [5, 99] } } })),
      ["Hello World"],
    );
    assert.deepEqual(
      titles(
        await cms.find({
          type: "post",
          where: { published: { gte: "2024-02-01", lt: "2024-07-01" } },
          sort: "-published",
        }),
      ),
      ["Release notes", "Getting started"],
    );
    assert.deepEqual(
      titles(
        await cms.find({
          type: "post",
          where: { or: [{ views: { lt: 10 } }, { headline: { contains: "dive" } }] },
          sort: "title",
        }),
      ),
      ["Deep dive", "Hello World"],
    );
    assert.equal((await cms.find({ type: "post", where: { author: ada } })).total, 4);
  });

  test("sorts and pages", async () => {
    const page = await cms.find({ type: "post", sort: "-views", limit: 2, offset: 1 });
    assert.equal(page.total, 4);
    assert.deepEqual(titles(page), ["Deep dive", "Release notes"]);
  });

  test("finds entries of all collections by the keys they share", async () => {
    const result = await cms.find({ where: { title: { contains: "a" } }, sort: "title" });
    assert.deepEqual(
      result.items.map((item) => `${item.type}:${item.title}`),
      ["author:Ada", "post:Getting started", "author:Grace", "post:Release notes"],
    );
    assert.deepEqual(result.items[0].values, { name: "Ada", active: true });
  });

  test("rejects unknown keys and operators", async () => {
    assert.equal(await errorOf(cms.find({ type: "post", where: { pages: 1 } })), "invalid pages");
    assert.equal(await errorOf(cms.find({ where: { views: 1 } })), "invalid views");
    assert.equal(await errorOf(cms.find({ type: "post", where: { views: { near: 1 } as never } })), "invalid views.near");
    assert.equal(await errorOf(cms.find({ type: "post", sort: "-pages" })), "invalid -pages");
  });
});

describe("values", () => {
  test("stores booleans and dates as they are submitted", async () => {
    const { entityId } = await cms.create("post", {
      values: { headline: "Dates", featured: "false", published: "2024-02-29", updated: "2024-05-01T12:30:00+02:00" },
    });

    const post = await cms.get(entityId, { type: "post" });
    assert.equal(post?.values.featured, false);
    assert.equal(post?.values.published, "2024-02-29");
    assert.equal(post?.values.updated, "2024-05-01T10:30:00.000Z");
  });

  test("rejects invalid booleans and dates", async () => {
    const create = (values: Record<string, unknown>) =>
      errorOf(cms.create("post", { values: { headline: "Invalid", ...values } }));

    assert.equal(await create({ featured: "yes" }), "invalid featured");
    assert.equal(await create({ published: "2023-02-29" }), "invalid published");
    assert.equal(await create({ published: "29.02.2024" }), "invalid published");
    assert.equal(await create({ updated: "soon" }), "invalid updated");
  });
});

describe("collections", () => {
  test("keeps unique values unique", async () => {
    assert.equal(await errorOf(cms.create("author", { values: { name: "Ada" } })), "taken name");

    const { entityId } = await cms.create("author", { values: { name: "Linus" } });
    assert.equal(await errorOf(cms.propose(entityId, { values: { name: "Grace" } })), "taken name");
    assert.equal(await errorOf(cms.propose(entityId, { values: { name: "Linus" } })), "unchanged");
    await cms.propose(entityId, { values: { name: "Linus T." } });
  });

  test("counts entries waiting for review for unique values", async () => {
    const { entityId, versionId } = await cms.create("draft", { values: { title: "Plan" } });

    assert.equal(await errorOf(cms.create("draft", { values: { title: "Plan" } })), "taken title");
    assert.equal((await cms.find({ type: "draft" })).total, 0);
    assert.deepEqual(
      (await cms.pending()).map((version) => `${version.type}:${version.title}`),
      ["draft:Plan"],
    );

    await cms.review(entityId, versionId, { status: "approved" });
    assert.deepEqual(titles(await cms.find({ type: "draft" })), ["Plan"]);
  });

  test("publishes right away without review", async () => {
    const { entityId } = await cms.create("author", { values: { name: "Margaret" } });
    const author = await cms.get(entityId);

    assert.equal(author?.status, "approved");
    assert.equal(author?.authorId, null);
    assert.deepEqual((await cms.history(entityId))?.versions.length, 1);
  });

  test("keeps only the current version without history", async () => {
    const { entityId, versionId: first } = await cms.create("note", { values: { text: "One" } });
    await cms.propose(entityId, { values: { text: "Two" } });
    const third = await cms.propose(entityId, { values: { text: "Three" } });

    const history = await cms.history(entityId);
    assert.equal(history?.title, "Three");
    assert.deepEqual(history?.versions.map((version) => version.versionId), [third]);
    assert.equal(await cms.get(entityId, { versionId: first }), undefined);
  });

  test("has exactly one entry in a singleton", async () => {
    assert.equal(await cms.getSingle("settings"), undefined);

    await cms.saveSingle("settings", { values: { site_name: "Portfolio" } });
    await cms.saveSingle("settings", { values: { site_name: "My Portfolio" } });

    assert.equal((await cms.getSingle("settings"))?.values.site_name, "My Portfolio");
    assert.equal((await cms.find({ type: "settings" })).total, 1);
    assert.equal(await errorOf(cms.create("settings", { values: { site_name: "Second" } })), "exists");
  });

  test("refuses a title that isn't a text field", () => {
    assert.throws(
      () =>
        createCMS({
          db: postgresAdapter({ sql }),
          collections: { thing: { title: "count", fields: { count: { type: "number" } } } },
        }),
      /title of thing/,
    );
  });
});
