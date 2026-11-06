import { accepts } from "hono/accepts";
import { getCookie, setCookie } from "hono/cookie";
import { parseLocalUrl } from "./local-url";
import { getAvailableLanguages, isLanguageSupported } from "./translation";
import type { DefaultContext } from "./utils";

export const LANGUAGE_COOKIE = "wikibricks_lang";
export const LANGUAGE_COOKIE_DAYS = 365;

export async function detectLanguage(c: DefaultContext, next: () => Promise<void>) {
  const candidates = [c.req.query("lang"), getCookie(c, LANGUAGE_COOKIE)];
  const preferred = candidates.find(language =>
    language !== undefined && isLanguageSupported(language)
  );

  const language = preferred ?? accepts(c, {
    header: "Accept-Language",
    supports: getAvailableLanguages(),
    default: "en",
    match: (accepted) => accepted
      .filter(({ q }) => q > 0)
      .map(({ type }) => type.split("-")[0].toLowerCase())
      .find(isLanguageSupported) ?? "en",
  });
  c.set("language", isLanguageSupported(language) ? language : "en");

  await next();
  if (c.res.headers.get("Content-Type")?.startsWith("text/html")) {
    c.header("Vary", "Cookie, Accept-Language", { append: true });
  }
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
  target?.searchParams.delete("lang");

  setCookie(c, LANGUAGE_COOKIE, lang, {
    httpOnly: true,
    sameSite: "Lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: LANGUAGE_COOKIE_DAYS * 24 * 60 * 60,
  });
  c.header("Cache-Control", "no-store");
  return c.redirect(target ? target.pathname + target.search + target.hash : "/", 303);
}
