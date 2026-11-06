import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
import type { Context } from "hono";
import { accepts } from "hono/accepts";

const createAsset = (name: string, extension: "css" | "js"): {
  url: string;
  handle: (c: Context) => Response | Promise<Response>;
} => {
  const file = join(__dirname, "../dist/public", `${name}.${extension}`);
  const contentType = extension === "css" ? "text/css" : "text/javascript";
  const headers = { "Content-Type": `${contentType}; charset=UTF-8` };

  if (process.env.NODE_ENV !== "production") {
    return {
      url: `/assets/${name}.${extension}`,
      handle: async (c: Context) => c.body(await readFile(file, "utf8"), 200, {
        ...headers,
        "Cache-Control": "no-store",
      }),
    };
  }

  const content = readFileSync(file, "utf8");
  const compressed = new Uint8Array(gzipSync(content));
  const hash = createHash("sha256").update(content).digest("hex").slice(0, 16);
  return {
    url: `/assets/${name}.${hash}.${extension}`,
    handle: (c: Context) => {
      const encoding = accepts(c, {
        header: "Accept-Encoding",
        supports: ["gzip", "identity"],
        default: "identity",
        match: (encodings) => encodings.find(({ type, q }) =>
          q > 0 && (type === "gzip" || type === "identity")
        )?.type ?? "identity",
      });
      const cacheHeaders = {
        ...headers,
        "Cache-Control": "public, max-age=31536000, immutable",
        Vary: "Accept-Encoding",
      };
      if (encoding === "gzip") {
        return c.body(compressed, 200, { ...cacheHeaders, "Content-Encoding": "gzip" });
      }
      return c.body(content, 200, cacheHeaders);
    },
  };
};

export const stylesheet = createAsset("styles", "css");
export const browserScripts = {
  "new-entity": createAsset("new-entity", "js"),
};
