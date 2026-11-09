import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, renameSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { Context, Next } from "hono";
import { getMimeType } from "hono/utils/mime";

const production = process.env.NODE_ENV === "production";
const clientDirectory = join(import.meta.dirname, "../dist/client");
const assetDirectory = join(clientDirectory, "assets");
const publicDirectory = join(import.meta.dirname, "../public");
const sharedDirectory = production ? process.env.ASSET_STORE_DIR : undefined;
const assetDirectories = [assetDirectory, ...(sharedDirectory ? [sharedDirectory] : [])];
const assetPattern = /^[\w-]+(?:\.[\w-]+)+$/;
const publicPattern = /^\/(?:[\w-]+\/)*[\w-]+(?:\.[\w-]+)+$/;

type Manifest = Record<string, { file: string }>;

function readManifest(): Manifest {
  return JSON.parse(readFileSync(join(clientDirectory, ".vite/manifest.json"), "utf8"));
}

// Copies this build's files into the shared store, so pages rendered by an
// earlier or later release can still load them.
function publishAssets(store: string) {
  mkdirSync(store, { recursive: true });
  for (const file of readdirSync(assetDirectory)) {
    const destination = join(store, file);
    if (existsSync(destination)) continue;
    const temporary = join(store, `.${file}.${process.pid}`);
    copyFileSync(join(assetDirectory, file), temporary);
    renameSync(temporary, destination);
  }
}

// Development rereads the manifest so `vite build --watch` output is picked up.
const manifest = production ? readManifest() : undefined;
if (sharedDirectory) publishAssets(sharedDirectory);

export function assetUrl(source: string): string {
  const entry = (manifest ?? readManifest())[source];
  if (!entry) throw new Error(`Missing asset: ${source}`);
  return "/" + entry.file;
}

async function readFirst(directories: string[], file: string) {
  for (const directory of directories) {
    try {
      return new Uint8Array(await readFile(join(directory, file)));
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== "ENOENT" && code !== "EISDIR") throw error;
    }
  }
}

const contentType = (file: string) => getMimeType(file) ?? "application/octet-stream";

export const handleAsset = async (c: Context) => {
  const file = c.req.param("file") ?? "";
  const content = assetPattern.test(file) ? await readFirst(assetDirectories, file) : undefined;
  if (!content) return c.text("Asset not found", 404, { "Cache-Control": "no-store" });
  return c.body(content, 200, {
    "Content-Type": contentType(file),
    "Cache-Control": production ? "public, max-age=31536000, immutable" : "no-store",
    Vary: "Accept-Encoding",
  });
};

// Files in public/ keep their URLs, so browsers revalidate them by ETag.
export const handlePublicFile = async (c: Context, next: Next) => {
  const path = c.req.path;
  const content = publicPattern.test(path) ? await readFirst([publicDirectory], path) : undefined;
  if (!content) return next();

  const etag = `"${createHash("sha256").update(content).digest("base64url").slice(0, 22)}"`;
  const headers = { ETag: etag, "Cache-Control": "no-cache", Vary: "Accept-Encoding" };
  if (c.req.header("If-None-Match") === etag) return c.body(null, 304, headers);
  return c.body(content, 200, { ...headers, "Content-Type": contentType(path) });
};
