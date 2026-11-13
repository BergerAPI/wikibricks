import { html } from "hono/html";
import type { Child } from "hono/jsx";
import { dateFormats, type DateFormat } from "./shared/contracts";
import type { DefaultContext } from "./utils";
import en from "./locales/en";
import de from "./locales/de";

const translations = { en, de };
export type Language = keyof typeof translations;
export type Translations = typeof en;

export const getAvailableLanguages = () => Object.keys(translations) as Language[];

export const isLanguageSupported = (language: string): language is Language =>
  Object.hasOwn(translations, language);

// Every page lives under its language, like /en/entities/search
export const localPath = (language: Language, path: string) => `/${language}${path === "/" ? "" : path}`;

const languagePrefix = new RegExp(`^/(?:${getAvailableLanguages().join("|")})(?=/|$)`);

export const hasLanguage = (pathname: string) => languagePrefix.test(pathname);
export const stripLanguage = (pathname: string) => pathname.replace(languagePrefix, "") || "/";

const locales: Record<Language, string> = { en: "en-US", de: "de-DE" };
const warnedMissingKeys = new Set<string>();

export const t = (
  key: keyof Translations,
  language: Language,
  variables: Record<string, string> = {},
) => {
  let text = translations[language][key];

  if (!text) {
    if (!warnedMissingKeys.has(`${language}:${key}`)) {
      warnedMissingKeys.add(`${language}:${key}`);
      console.warn(`Translation missing for key: ${key} in language: ${language}`);
    }
    text = translations.en[key] || key;
  }

  // split/join instead of a RegExp, so variable names can't inject patterns
  for (const [name, value] of Object.entries(variables)) {
    text = text.split(`{${name}}`).join(value);
  }
  return text;
};

/**
 * Puts elements like links into the {placeholders} of a translated text.
 */
export const fill = (text: string, values: Record<string, Child>) =>
  text.split(/\{(\w+)\}/).map((part, index) => (index % 2 ? values[part] ?? `{${part}}` : part));

const formatTime = (date: Date, format: DateFormat, locale: string) => {
  const value = new Date(date);
  const text = value.toLocaleString(locale, { ...dateFormats[format], timeZone: "UTC" });
  return html`<time datetime="${value.toISOString()}" data-format="${format}">${text}</time>`;
};

export const useTranslation = (c: DefaultContext) => {
  const language = c.get("language") ?? "en";
  const locale = locales[language];

  return {
    language,
    t: (key: keyof Translations, variables?: Record<string, string>) =>
      t(key, language, variables),
    url: (path: string) => localPath(language, path),
    formatDate: (date: Date) => formatTime(date, "date", locale),
    formatDateTime: (date: Date) => formatTime(date, "datetime", locale),
  };
};

export type TranslationFunctions = ReturnType<typeof useTranslation>;
