import { parseId } from "@wikibricks/cms";
import type { DefaultContext } from "./utils";

const transliterations: Record<string, string> = { ä: "ae", ö: "oe", ü: "ue", ß: "ss" };

/**
 * Turns a name into the readable part of a URL, like "Farm House" into "farm-house".
 */
export const slugify = (text: string) =>
  text
    .toLowerCase()
    .replace(/[äöüß]/g, (letter) => transliterations[letter])
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80)
    .replace(/-$/, "");

/**
 * The path of an entity's page, like /entities/12-farm-house. Only the ID identifies the entity,
 * the name is there for readers and search engines and may be outdated or missing.
 */
export const entityPath = (entry: { entityId: number; title?: string | null }) => {
  const slug = slugify(entry.title ?? "");
  return `/entities/${entry.entityId}${slug ? `-${slug}` : ""}`;
};

/**
 * Reads the ID from the entity part of a path, which is "12" or "12-farm-house".
 */
export const parseEntityId = (value: string) => parseId(/^(\d+)(?:-.*)?$/.exec(value)?.[1]);

// Behind a proxy the request doesn't show the public address, so production sets SITE_URL
export const siteUrl = (c: DefaultContext, path: string) =>
  (process.env.SITE_URL?.replace(/\/$/, "") || new URL(c.req.url).origin) + path;

const base = new URL("https://wikibricks.invalid");

/**
 * Parses an address within this site, like the page to return to after logging in. Anything else is undefined.
 */
export function parseLocalUrl(target: string | undefined): URL | undefined {
  if (!target?.startsWith("/") || target.startsWith("//") || /[\\\u0000-\u001f\u007f]/.test(target)) return;

  const url = new URL(target, base);
  if (url.origin !== base.origin || url.pathname.startsWith("//")) return;
  return url;
}

/**
 * Reads the zero-based page number from the query, falling back to the first page.
 */
export const readPage = (c: DefaultContext, pageSize: number) => {
  const page = Number(c.req.query("page"));
  return Number.isInteger(page) && page > 0 && Number.isSafeInteger(page * pageSize) ? page : 0;
};

/**
 * The address of a page, keeping the other query parameters and leaving out empty ones and the first page.
 */
export const pageLink = (path: string, query: Record<string, string>, page: number) => {
  const params = new URLSearchParams(Object.entries({ ...query, page: page ? String(page) : "" }).filter(([, value]) => value));
  return params.size ? `${path}?${params}` : path;
};
