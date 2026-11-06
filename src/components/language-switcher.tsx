import { useTranslation, getAvailableLanguages } from "../translation";
import type { DefaultContext } from "../utils";

export const LanguageSwitcher = ({ context }: { context: DefaultContext }) => {
  const { language: currentLang, t } = useTranslation(context);
  const { pathname, search } = new URL(context.req.url);

  return (
    <form method="post" action="/language" class="inline-flex items-center gap-2">
      <input type="hidden" name="returnTo" value={pathname + search} />
      <label for="language-switcher" class="sr-only">{t("nav.language")}</label>
      <select
        id="language-switcher"
        name="lang"
        class="bg-transparent border border-gray-300 rounded px-2 py-1 text-sm cursor-pointer hover:bg-gray-50"
      >
        {getAvailableLanguages().map((lang) => (
          <option value={lang} selected={lang === currentLang}>
            {lang === "en" ? "English" : "Deutsch"}
          </option>
        ))}
      </select>
      <button type="submit" class="text-sm">{t("action.submit")}</button>
    </form>
  );
};
