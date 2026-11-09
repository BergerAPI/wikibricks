import type { DefaultContext } from "./utils";
import en from "./locales/en";
import de from "./locales/de";

const translations = { en, de };
export type Language = keyof typeof translations;
export type Translations = typeof en;

export const getAvailableLanguages = () => Object.keys(translations) as Language[];

export const isLanguageSupported = (language: string): language is Language =>
  Object.hasOwn(translations, language);

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

export const useTranslation = (c: DefaultContext) => {
  const language = c.get("language") ?? "de";
  const locale = locales[language];

  return {
    language,
    t: (key: keyof Translations, variables?: Record<string, string>) =>
      t(key, language, variables),
    formatDate: (date: Date) => new Date(date).toLocaleDateString(locale),
    formatDateTime: (date: Date) => new Date(date).toLocaleString(locale),
  };
};

export type TranslationFunctions = ReturnType<typeof useTranslation>;
