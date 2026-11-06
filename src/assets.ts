import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { Context } from "hono";
import { accepts } from "hono/accepts";
import {
  assetDirectory,
  isAssetSource,
  isFingerprintedAsset,
  publicDirectory,
  readAssetManifest,
} from "./asset-manifest";

const production = process.env.NODE_ENV === "production";
const manifest = production ? readAssetManifest() : undefined;
const sharedDirectory = process.env.ASSET_STORE_DIR;

export function assetUrl(source: string): string {
  if (!isAssetSource(source)) throw new Error(`Invalid asset filename: ${source}`);
  if (manifest && !Object.prototype.hasOwnProperty.call(manifest, source)) {
    throw new Error(`Missing asset manifest entry for ${source}`);
  }
  return "/assets/" + (manifest?.[source] ?? source);
}

async function readAsset(directories: string[], file: string) {
  for (const directory of directories) {
    try {
      return new Uint8Array(await readFile(join(directory, file)));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
}

export const handleAsset = async (c: Context) => {
  const file = c.req.param("file");
  if (production ? !isFingerprintedAsset(file) : !isAssetSource(file)) {
    return c.text("Asset not found", 404, { "Cache-Control": "no-store" });
  }

  const contentType = file.endsWith(".css") ? "text/css" : "text/javascript";
  const headers = {
    "Content-Type": `${contentType}; charset=UTF-8`,
    "Cache-Control": production ? "public, max-age=31536000, immutable" : "no-store",
  };

  const directories = production
    ? [assetDirectory, ...(sharedDirectory ? [sharedDirectory] : [])]
    : [publicDirectory];

  if (production) {
    c.header("Vary", "Accept-Encoding");
    const encoding = accepts(c, {
      header: "Accept-Encoding",
      supports: ["gzip", "identity"],
      default: "identity",
      match: (encodings) => encodings.find(({ type, q }) =>
        q > 0 && (type === "gzip" || type === "identity")
      )?.type ?? "identity",
    });
    if (encoding === "gzip") {
      const compressed = await readAsset(directories, file + ".gz");
      if (compressed) return c.body(compressed, 200, { ...headers, "Content-Encoding": "gzip" });
    }
  }

  const content = await readAsset(directories, file);
  if (!content) return c.text("Asset not found", 404, { "Cache-Control": "no-store" });
  return c.body(content, 200, headers);
};
