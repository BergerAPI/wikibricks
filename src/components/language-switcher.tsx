import { useTranslation, getAvailableLanguages } from "../translation";
import type { DefaultContext } from "../utils";

export const LanguageSwitcher = ({ context }: { context: DefaultContext }) => {
  const { language: currentLang, t } = useTranslation(context);

  return (
    <form method="get" class="relative inline-block">
      {Object.entries(context.req.queries()).flatMap(([name, values]) =>
        name === "lang"
          ? []
          : values.map(value => <input type="hidden" name={name} value={value} />)
      )}
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
      <button type="submit">{t("action.submit")}</button>
    </form>
  );
};
