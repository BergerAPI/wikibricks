import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
import type { Context } from "hono";
import { accepts } from "hono/accepts";

const file = join(__dirname, "../dist/public/styles.css");
const productionCss = process.env.NODE_ENV === "production"
  ? readFileSync(file, "utf8")
  : undefined;
const compressedCss = productionCss === undefined
  ? undefined
  : new Uint8Array(gzipSync(productionCss));

export const stylesheetUrl = productionCss === undefined
  ? "/assets/styles.css"
  : `/assets/styles.${createHash("sha256").update(productionCss).digest("hex").slice(0, 16)}.css`;

export const handleStylesheet = async (c: Context) => {
  const contentType = "text/css; charset=UTF-8";
  if (productionCss === undefined) {
    return c.body(await readFile(file, "utf8"), 200, {
      "Content-Type": contentType,
      "Cache-Control": "no-store",
    });
  }

  const encoding = accepts(c, {
    header: "Accept-Encoding",
    supports: ["gzip", "identity"],
    default: "identity",
    match: (encodings) => encodings.find(({ type, q }) =>
      q > 0 && (type === "gzip" || type === "identity")
    )?.type ?? "identity",
  });
  const headers = {
    "Content-Type": contentType,
    "Cache-Control": "public, max-age=31536000, immutable",
    Vary: "Accept-Encoding",
  };
  if (encoding === "gzip" && compressedCss) {
    return c.body(compressedCss, 200, { ...headers, "Content-Encoding": "gzip" });
  }
  return c.body(productionCss, 200, headers);
};
