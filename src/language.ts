import { accepts } from "hono/accepts";
import { getCookie, setCookie } from "hono/cookie";
import {
  getAvailableLanguages,
  hasLanguage,
  isLanguageSupported,
  localPath,
  stripLanguage,
  type Language,
} from "./translation";
import { parseLocalUrl } from "./urls";
import { routeParam, type DefaultContext } from "./utils";

export const LANGUAGE_COOKIE = "wikibricks_lang";
export const LANGUAGE_COOKIE_DAYS = 365;

// Paths from before the pages had English names
const renamedPaths: Record<string, string> = {
  "/datenschutz": "/privacy",
  "/impressum": "/imprint",
  "/nutzungsbedingungen": "/terms",
};

// The language of a page is the first part of its path
export async function detectLanguage(c: DefaultContext, next: () => Promise<void>) {
  c.set("language", routeParam(c, "lang") as Language);

  await next();
  if (c.res.headers.get("Content-Type")?.startsWith("text/html")) {
    c.header("Vary", "Cookie", { append: true });
  }
}

/**
 * Sends requests for a path without a language to the same page in the visitor's language.
 */
export function redirectToLanguage(c: DefaultContext) {
  const url = new URL(c.req.url);
  if (hasLanguage(url.pathname)) {
    // /en/ is /en, anything else under a language that got here doesn't exist
    return url.pathname.endsWith("/")
      ? c.redirect(url.pathname.replace(/\/+$/, "") + url.search, 301)
      : c.notFound();
  }

  const candidates = [url.searchParams.get("lang"), getCookie(c, LANGUAGE_COOKIE)];
  const preferred = candidates.find((language) => language != null && isLanguageSupported(language));
  const language = preferred ?? accepts(c, {
    header: "Accept-Language",
    supports: getAvailableLanguages(),
    default: "en",
    match: (accepted) => accepted
      .filter(({ q }) => q > 0)
      .map(({ type }) => type.split("-")[0].toLowerCase())
      .find(isLanguageSupported) ?? "en",
  });

  url.searchParams.delete("lang");
  const path = url.pathname.replace(/\/+$/, "") || "/";
  c.header("Vary", "Cookie, Accept-Language");
  c.header("Cache-Control", "no-store");
  return c.redirect(
    localPath(isLanguageSupported(language) ? language : "en", renamedPaths[path] ?? path) + url.search,
    // Old links keep working for good, only the start page depends on who asks
    path === "/" ? 302 : 301,
  );
}

export async function handleLanguagePreference(c: DefaultContext) {
  if (c.req.header("Sec-Fetch-Site") === "cross-site") return c.text("Forbidden", 403);

  let fields;
  try {
    fields = await c.req.parseBody();
  } catch {
    return c.text("Invalid language preference", 400);
  }
  const { lang, returnTo } = fields;
  if (typeof lang !== "string" || !isLanguageSupported(lang)) {
    return c.text("Invalid language preference", 400);
  }

  const target = parseLocalUrl(typeof returnTo === "string" ? returnTo : undefined);

  setCookie(c, LANGUAGE_COOKIE, lang, {
    httpOnly: true,
    sameSite: "Lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: LANGUAGE_COOKIE_DAYS * 24 * 60 * 60,
  });
  c.header("Cache-Control", "no-store");
  return c.redirect(
    target ? localPath(lang, stripLanguage(target.pathname)) + target.search + target.hash : localPath(lang, "/"),
    303,
  );
}
