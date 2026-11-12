import assert from "node:assert/strict";
import { mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { Hono } from "hono";
import sharp from "sharp";
import type { User } from "../database";
import type { Variables } from "../utils";

const app = new Hono<{ Variables: Variables }>();
const users = new Map<number, User>();
let directory: string;
let db: PGlite;
let socket: PGLiteSocketServer;
let sql: typeof import("../database").sql;
let pruneAbandonedImages: typeof import("../services/image-storage").pruneAbandonedImages;
let photo: Buffer;

const request = (path: string, user?: number, init?: RequestInit) => {
  const headers = new Headers(init?.headers);
  if (user !== undefined) headers.set("test-user", String(user));
  return app.request(path, { ...init, headers });
};

const upload = (user?: number, data: Uint8Array = photo, mime = "image/jpeg") => {
  const body = new FormData();
  body.set("file", new Blob([new Uint8Array(data)], { type: mime }), "sample.jpg");
  return request("/images/upload", user, { method: "POST", body });
};

const json = (method: string, body: object) => ({
  method, body: JSON.stringify(body), headers: { "Content-Type": "application/json" },
});

const createEntry = (user: number, imageId: number, name: string) => request("/entities/new", user, json("POST", {
  entity_type: "wiki", name, description: "A test entry for image moderation.", image_id: imageId, fields: {},
}));

const fileInfo = async (response: Response) => {
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Content-Type"), "image/webp");
  const data = Buffer.from(await response.arrayBuffer());
  assert.equal(Number(response.headers.get("Content-Length")), data.length);
  return sharp(data).metadata();
};

before(async () => {
  directory = await mkdtemp(join(tmpdir(), "wikibricks-images-"));
  db = new PGlite();
  socket = new PGLiteSocketServer({ db, port: 0, maxConnections: 4 });
  await socket.start();
  process.env.DB_CONN = `postgres://postgres:postgres@${socket.getServerConn()}/postgres?max=1`;
  process.env.UPLOAD_DIR = directory;
  ({ sql } = await import("../database"));
  ({ pruneAbandonedImages } = await import("../services/image-storage"));
  const { cms } = await import("../collections");
  const images = await import("../routes/images");
  const { handleNewEntitySubmit } = await import("../routes/entities/new-entity");
  const { handleEntityPageSubmit, handleEntityVersionPatch } = await import("../routes/entities");
  await cms.init();
  const people = await sql<User[]>`
    INSERT INTO users (username, permission_level)
    VALUES ('author', 0), ('visitor', 0), ('moderator', 5), ('limited', 0), ('spam', 0), ('concurrent', 0)
    RETURNING *
  `;
  for (const person of people) users.set(person.id, person);

  app.use(async (c, next) => {
    c.set("user", users.get(Number(c.req.header("test-user"))));
    await next();
  });
  app.post("/images/upload", images.guardImageUpload, images.limitImageUpload, images.handleImageUpload);
  app.get("/images/serve/:id", images.handleImageServe);
  app.get("/images/:id/info", images.handleImageInfo);
  app.get("/images/:id", images.handleImagePage);
  app.delete("/images/:id", images.handleImageDelete);
  app.post("/entities/new", handleNewEntitySubmit);
  app.post("/entities/:id", handleEntityPageSubmit);
  app.patch("/entities/:id/:version", handleEntityVersionPatch);

  photo = await sharp({ create: { width: 1200, height: 2400, channels: 3, background: "#5577aa" } })
    .jpeg().withMetadata({ orientation: 6 }).toBuffer();
});

after(async () => {
  await sql?.end();
  await socket?.stop();
  await db?.close();
  if (directory) await rm(directory, { recursive: true, force: true });
});

test("rejects anonymous, oversized, corrupt, and mismatched uploads without writing a file", async () => {
  assert.equal((await upload()).status, 401);
  assert.equal((await upload(1, new Uint8Array(10 * 1024 * 1024 + 1))).status, 413);
  assert.equal((await upload(1, new Uint8Array([1, 2, 3]))).status, 415);
  assert.equal((await upload(1, photo, "image/png")).status, 415);
  assert.deepEqual(await readdir(directory), []);
});

test("accepts PNG and WebP and preserves transparency without enlarging the master", async () => {
  const png = await sharp({ create: { width: 20, height: 30, channels: 4, background: "#5588aa55" } }).png().toBuffer();
  const webp = await sharp(png).webp().toBuffer();
  for (const [format, data] of [["png", png], ["webp", webp]] as const) {
    const response = await upload(1, data, `image/${format}`);
    assert.equal(response.status, 200);
    const { id } = await response.json() as { id: number };
    const { width, height, hasAlpha } = await fileInfo(await request(`/images/serve/${id}`, 1));
    assert.deepEqual({ width, height, hasAlpha }, { width: 20, height: 30, hasAlpha: true });
    assert.equal((await request(`/images/${id}`, 1, { method: "DELETE" })).status, 200);
  }
});

test("keeps the master private until approval and serves both sizes after approval", async () => {
  const response = await upload(1);
  assert.equal(response.status, 200);
  const payload = await response.json() as { id: number };
  assert.deepEqual(Object.keys(payload), ["id"]);
  const { id } = payload;
  const url = `/images/serve/${id}`;
  const info = `/images/${id}/info`;

  assert.equal((await readdir(directory)).length, 1);
  for (const path of [url, info, `/images/${id}`]) {
    const denied = await request(path, 2);
    assert.equal(denied.status, 404);
    assert.equal(denied.headers.get("Cache-Control"), "private, no-store");
  }
  assert.equal((await request(url)).status, 404);
  const preview = await request(url + "?width=480", 1);
  assert.equal(preview.headers.get("Cache-Control"), "private, no-store");
  const master = await fileInfo(preview);
  assert.equal(master.width, 2048);
  assert.equal(master.height, 1024);
  assert.equal(master.exif, undefined);
  assert.equal((await request(info, 3)).status, 200);

  assert.equal((await createEntry(2, id, "Unauthorized attachment")).status, 400);
  const proposed = await createEntry(1, id, "Image under review");
  assert.equal(proposed.status, 200);
  const entry = await proposed.json() as { entity_id: number; id: number };
  assert.equal((await request(url)).status, 404);
  assert.equal((await readdir(directory)).length, 1);
  assert.equal((await request(`/images/${id}`, 1, { method: "DELETE" })).status, 409);

  const approved = await request(`/entities/${entry.entity_id}/${entry.id}`, 3, json("PATCH", {
    type: "approved", reviewMessage: "Image approved",
  }));
  assert.equal(approved.status, 200);
  assert.equal((await readdir(directory)).length, 3);
  assert.equal((await request(info)).status, 200);
  for (const width of [480, 960]) {
    const path = url + `?width=${width}`;
    const variant = await request(path);
    assert.match(variant.headers.get("Cache-Control") ?? "", /^public/);
    const etag = variant.headers.get("ETag");
    assert.ok(etag);
    assert.equal((await fileInfo(variant)).width, width);
    const conditional = await request(path, undefined, { headers: { "If-None-Match": etag } });
    assert.equal(conditional.status, 304);
    const head = await request(path, undefined, { method: "HEAD" });
    assert.equal(head.status, 200);
    assert.ok(Number(head.headers.get("Content-Length")) > 0);
    assert.equal(await head.text(), "");
  }

  // A later approved edit keeps the first version and its image visible in history.
  assert.equal((await request(`/entities/${entry.entity_id}`, 2, json("POST", {
    fields: { image_id: String(id) }, changeMessage: "Try to attach someone else's image",
  }))).status, 400);
  const edit = await request(`/entities/${entry.entity_id}`, 1, json("POST", {
    fields: { image_id: "" }, changeMessage: "Remove image from the current version",
  }));
  assert.equal(edit.status, 200);
  const [{ version }] = await sql<{ version: number }[]>`
    SELECT MAX(id) AS version FROM entity_versions WHERE entity_id = ${entry.entity_id}
  `;
  assert.equal((await request(`/entities/${entry.entity_id}/${version}`, 3, json("PATCH", {
    type: "approved", reviewMessage: "",
  }))).status, 200);
  const historical = await request(url);
  assert.equal(historical.status, 200);
  await historical.arrayBuffer();
  await sql`UPDATE images SET created_at = NOW() - INTERVAL '2 days' WHERE id = ${id}`;
  assert.equal(await pruneAbandonedImages(), 0);
  assert.equal((await request(`/images/${id}`, 3, { method: "DELETE" })).status, 200);
  assert.equal((await request(url)).status, 404);
  assert.deepEqual(await readdir(directory), []);
});

test("rejects a proposal without generating sizes and cleans up only expired unattached files", async () => {
  const { id } = await (await upload(1)).json() as { id: number };
  const entry = await (await createEntry(1, id, "Rejected image")).json() as { entity_id: number; id: number };
  assert.equal((await request(`/entities/${entry.entity_id}/${entry.id}`, 3, json("PATCH", {
    type: "rejected", reviewMessage: "Please replace the image.",
  }))).status, 200);
  assert.deepEqual(await readdir(directory), []);

  const old = await (await upload(1)).json() as { id: number };
  const fresh = await (await upload(1)).json() as { id: number };
  await sql`UPDATE images SET created_at = NOW() - INTERVAL '2 days' WHERE id = ${old.id}`;
  assert.equal(await pruneAbandonedImages(), 1);
  assert.equal((await request(`/images/${old.id}/info`, 1)).status, 404);
  assert.equal((await request(`/images/${fresh.id}/info`, 1)).status, 200);
  assert.equal((await readdir(directory)).length, 1);
});

test("limits successful uploads and repeated invalid attempts per account", async () => {
  await sql`INSERT INTO images (filename, original_filename, file_path, file_size, mime_type, uploaded_by)
    SELECT 'quota-' || n, 'quota', 'unused', 1, 'image/webp', 4 FROM generate_series(1, 20) n`;
  assert.equal((await upload(4)).status, 429);
  for (let i = 0; i < 30; i++) assert.equal((await upload(5, new Uint8Array([1]))).status, 415);
  assert.equal((await upload(5)).status, 429);
  assert.equal((await readdir(directory)).length, 1);
});

test("rejects a second upload for the same account while its first body is still being read", async () => {
  const form = new FormData();
  form.set("file", new Blob([new Uint8Array(photo)], { type: "image/jpeg" }), "sample.jpg");
  const encoded = new Request("http://localhost/images/upload", { method: "POST", body: form });
  const bytes = new Uint8Array(await encoded.arrayBuffer());
  let started!: () => void;
  let finish!: () => void;
  const reading = new Promise<void>((resolve) => { started = resolve; });
  const release = new Promise<void>((resolve) => { finish = resolve; });
  const body = new ReadableStream<Uint8Array>({
    async pull(controller) {
      started();
      await release;
      controller.enqueue(bytes);
      controller.close();
    },
  }, { highWaterMark: 0 });
  const init: RequestInit = { method: "POST", headers: encoded.headers, body, duplex: "half" };
  const first = request("/images/upload", 6, init);
  await reading;
  try {
    const second = await upload(6);
    assert.equal(second.status, 429);
    assert.equal(second.headers.get("Retry-After"), "5");
  } finally {
    finish();
  }
  const saved = await first;
  assert.equal(saved.status, 200);
  const { id } = await saved.json() as { id: number };
  assert.equal((await request(`/images/${id}`, 6, { method: "DELETE" })).status, 200);
});

test("serves an existing approved JPEG when it has no generated sizes", async () => {
  const path = join(directory, "legacy.jpg");
  await writeFile(path, photo);
  const [{ id }] = await sql<{ id: number }[]>`
    INSERT INTO images (filename, original_filename, file_path, file_size, mime_type, uploaded_by, width, height)
    VALUES ('legacy.jpg', 'legacy.jpg', ${path}, ${photo.length}, 'image/jpeg', 1, 1200, 2400)
    RETURNING id
  `;
  const entry = await (await createEntry(1, id, "Existing approved JPEG")).json() as { entity_id: number; id: number };
  const { cms } = await import("../collections");
  await cms.review(entry.entity_id, entry.id, { status: "approved", reviewerId: 3 });

  const files = await readdir(directory);
  const response = await request(`/images/serve/${id}?width=480`);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Content-Type"), "image/jpeg");
  assert.deepEqual(Buffer.from(await response.arrayBuffer()), photo);
  assert.deepEqual(await readdir(directory), files);
  assert.equal((await request(`/images/${id}`, 3, { method: "DELETE" })).status, 200);
});
