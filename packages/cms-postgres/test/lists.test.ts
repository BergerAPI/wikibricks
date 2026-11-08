import { CmsError, createCMS, type Block } from "@wikibricks/cms";
import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import type postgres from "postgres";
import { postgresAdapter } from "../src";
import { startDatabase } from "./database";

const hero = {
  slug: "hero",
  fields: {
    heading: { type: "text", required: true },
    image: { type: "external", table: "files" },
  },
} satisfies Block;

const text = { slug: "text", fields: { body: { type: "text", required: true } } } satisfies Block;

// Columns can hold any block, themselves included
const content: Block[] = [hero, text];
const columns = {
  slug: "columns",
  fields: {
    columns: {
      type: "array",
      fields: {
        width: { type: "number" },
        content: { type: "blocks", blocks: content },
      },
    },
  },
} satisfies Block;
content.push(columns);

const collections = {
  page: {
    title: "title",
    fields: {
      title: { type: "text", required: true },
      sections: { type: "blocks", blocks: content },
    },
  },
  project: {
    fields: {
      links: {
        type: "array",
        fields: { label: { type: "text", required: true }, url: { type: "text" } },
      },
    },
  },
} as const;

let sql: postgres.Sql;
let stop: () => Promise<void>;
let cms: ReturnType<typeof createCMS<typeof collections>>;
let fileId: number;

before(async () => {
  ({ sql, stop } = await startDatabase());

  cms = createCMS({
    db: postgresAdapter({
      sql,
      migrations: { files: (sql) => sql`CREATE TABLE files (id SERIAL PRIMARY KEY)` },
    }),
    collections,
    review: false,
  });
  await cms.init();
  [{ id: fileId }] = await sql<{ id: number }[]>`INSERT INTO files DEFAULT VALUES RETURNING id`;
});

after(() => stop());

const sections = () => [
  { block: "hero", heading: "Hello", image: fileId },
  {
    block: "columns",
    columns: [
      { width: 6, content: [{ block: "text", body: "Left" }] },
      {
        width: 6,
        content: [
          { block: "hero", heading: "Right", image: null },
          { block: "columns", columns: [{ width: 12, content: [{ block: "text", body: "Deep" }] }] },
        ],
      },
    ],
  },
  { block: "text", body: "Bye" },
];

const errorOf = (promise: Promise<unknown>) =>
  promise.then(
    () => assert.fail("expected an error"),
    (error: CmsError) => `${error.code} ${error.field ?? ""}`.trim(),
  );

describe("lists in postgres", () => {
  test("stores and loads nested blocks in order", async () => {
    const { entityId } = await cms.create("page", {
      values: { title: "Home", sections: sections() },
    });

    const page = await cms.get(entityId);
    assert.deepEqual(page?.values, { title: "Home", sections: sections() });
  });

  test("fills in missing optional values", async () => {
    const { entityId } = await cms.create("page", {
      values: { title: "Sparse", sections: [{ block: "hero", heading: "Hi" }, { block: "columns" }] },
    });

    const page = await cms.get(entityId);
    assert.deepEqual(page?.values.sections, [
      { block: "hero", heading: "Hi", image: null },
      { block: "columns", columns: [] },
    ]);
  });

  test("carries lists over to new versions and keeps old versions intact", async () => {
    const { entityId, versionId: first } = await cms.create("page", {
      values: { title: "About", sections: sections() },
    });

    const second = await cms.propose(entityId, { values: { title: "About me" } });
    assert.deepEqual((await cms.get(entityId, second))?.values.sections, sections());

    const third = await cms.propose(entityId, {
      values: { sections: [{ block: "text", body: "Shorter" }] },
    });
    assert.deepEqual((await cms.get(entityId, third))?.values, {
      title: "About me",
      sections: [{ block: "text", body: "Shorter" }],
    });
    assert.deepEqual((await cms.get(entityId, first))?.values.sections, sections());
    assert.deepEqual((await cms.get(entityId, second))?.values.sections, sections());
  });

  test("treats resubmitting the same lists as no change", async () => {
    const { entityId } = await cms.create("page", {
      values: { title: "Same", sections: sections() },
    });

    assert.equal(await errorOf(cms.propose(entityId, { values: { sections: sections() } })), "unchanged");
  });

  test("names the invalid value by its path", async () => {
    const create = (sections: unknown) =>
      errorOf(cms.create("page", { values: { title: "Invalid", sections } }));

    assert.equal(await create("hero"), "invalid sections");
    assert.equal(await create([{ block: "video" }]), "invalid sections.0.block");
    assert.equal(
      await create([{ block: "columns", columns: [{ content: [{ block: "text" }] }] }]),
      "invalid sections.0.columns.0.content.0.body",
    );
    assert.equal(
      await create([{ block: "columns", columns: [{ width: "wide" }] }]),
      "invalid sections.0.columns.0.width",
    );
  });

  test("stores arrays and clears them", async () => {
    const links = [
      { label: "Code", url: "https://example.com/code" },
      { label: "Demo", url: null },
    ];
    const { entityId } = await cms.create("project", { values: { links } });
    assert.deepEqual((await cms.get(entityId))?.values.links, links);

    const cleared = await cms.propose(entityId, { values: { links: [] } });
    assert.deepEqual((await cms.get(entityId, cleared))?.values.links, []);
  });

  test("finds references from inside blocks", async () => {
    const [{ id: unused }] = await sql<{ id: number }[]>`INSERT INTO files DEFAULT VALUES RETURNING id`;

    assert.equal(await cms.isReferenced("files", fileId), true);
    assert.equal(await cms.isReferenced("files", unused), false);
  });

  test("sets up the same schema again without changes", async () => {
    await cms.init();

    const tables = await sql<{ tablename: string }[]>`
      SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename
    `;
    assert.deepEqual(
      tables.map((table) => table.tablename),
      [
        "block_columns",
        "block_columns_columns",
        "block_hero",
        "block_text",
        "entities",
        "entity_relations",
        "entity_versions",
        "files",
        "migrations",
        "page",
        "project_links",
      ],
    );
  });
});
