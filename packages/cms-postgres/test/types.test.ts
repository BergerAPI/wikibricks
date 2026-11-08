import { createCMS, type EntryOf } from "@wikibricks/cms";
import assert from "node:assert/strict";
import { test } from "node:test";
import { postgresAdapter } from "../src";

// Only checks types: these assignments fail to compile if the inferred value types are wrong
const collections = {
  tag: { title: "name", fields: { name: { type: "text", required: true } } },
  post: {
    title: "title",
    fields: {
      title: { type: "text", required: true },
      status: { type: "select", options: ["draft", "live"] },
      views: { type: "number" },
      tags: { type: "relation", to: "tag", many: true },
      cover: { type: "relation", to: "tag" },
      sections: {
        type: "blocks",
        blocks: [
          { slug: "text", fields: { body: { type: "text", required: true } } },
          { slug: "gallery", fields: { images: { type: "array", fields: { url: { type: "text" } } } } },
        ],
      },
    },
  },
} as const;

type Cms = ReturnType<typeof createCMS<typeof collections>>;

const checks = async (cms: Cms) => {
  const post = await cms.get(1, { type: "post" });
  if (!post) return;

  const title: string = post.values.title;
  const status: "draft" | "live" | null = post.values.status;
  const views: number | null = post.values.views;
  const tags: number[] = post.values.tags;
  for (const section of post.values.sections) {
    if (section.block === "text") {
      const body: string = section.body;
    } else {
      const urls: (string | null)[] = section.images.map((image) => image.url);
    }
  }

  const populated = await cms.get(1, { type: "post", populate: true });
  const tagNames: string[] = populated?.values.tags.map((tag) => tag.values.name) ?? [];
  const cover: EntryOf<typeof collections, "tag"> | null = populated?.values.cover ?? null;

  const { items } = await cms.find({ type: "tag" });
  const names: string[] = items.map((tag) => tag.values.name);

  // Without a type, entries tell their collection by `type`
  const any = await cms.get(1);
  if (any?.type === "tag") {
    const name: string = any.values.name;
  }

  return [title, status, views, tags, tagNames, cover, names];
};

test("infers value types from the collections", () => {
  assert.equal(typeof checks, "function");
  assert.ok(postgresAdapter);
});
