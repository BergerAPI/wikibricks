import { cms } from "../collections";
import { getAvailableLanguages, localPath } from "../translation";
import { entityPath, siteUrl } from "../urls";
import type { DefaultContext } from "../utils";

const PAGE_SIZE = 1000;
// A sitemap holds at most 50,000 addresses
const MAX_PAGES = Math.floor(50_000 / getAvailableLanguages().length);

const escapeXml = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");

export const handleRobots = (c: DefaultContext) =>
  c.text(`User-agent: *\nAllow: /\n\nSitemap: ${siteUrl(c, "/sitemap.xml")}\n`);

/**
 * Lists the start page and every published entity, each in all languages.
 */
export const handleSitemap = async (c: DefaultContext) => {
  const paths = ["/"];
  for (let offset = 0; paths.length < MAX_PAGES; offset += PAGE_SIZE) {
    const entries = await cms.list({ sort: "createdAt", offset, limit: PAGE_SIZE });
    paths.push(...entries.map(entityPath));
    if (entries.length < PAGE_SIZE) break;
  }

  const languages = getAvailableLanguages();
  const address = (language: (typeof languages)[number], path: string) =>
    escapeXml(siteUrl(c, localPath(language, path)));
  const urls = paths.slice(0, MAX_PAGES).flatMap((path) =>
    languages.map((language) =>
      `<url><loc>${address(language, path)}</loc>${languages
        .map((other) => `<xhtml:link rel="alternate" hreflang="${other}" href="${address(other, path)}"/>`)
        .join("")}</url>`,
    ),
  );

  return c.body(
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
      `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n` +
      `${urls.join("\n")}\n</urlset>\n`,
    200,
    { "Content-Type": "application/xml; charset=UTF-8", "Cache-Control": "public, max-age=3600" },
  );
};
