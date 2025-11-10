import { useTranslation, getAvailableLanguages } from "../translation";
import { DefaultContext } from "../utils";

export const LanguageSwitcher = ({ context }: { context: DefaultContext }) => {
  const { language: currentLang } = useTranslation(context);
  const availableLanguages = getAvailableLanguages();

  return (
    <div class="relative inline-block">
      <select
        id="language-switcher"
        class="bg-transparent border border-gray-300 rounded px-2 py-1 text-sm cursor-pointer hover:bg-gray-50"
        onchange="handleLanguageChange(this.value)"
      >
        {availableLanguages.map((lang) => (
          <option value={lang} selected={lang === currentLang}>
            {lang === "en"
              ? "English"
              : lang === "de"
                ? "Deutsch"
                : (lang as string).toUpperCase()}
          </option>
        ))}
      </select>

      <script
        dangerouslySetInnerHTML={{
          __html: `
            function handleLanguageChange(newLang) {
              const url = new URL(window.location);
              url.searchParams.set('lang', newLang);
              window.location.href = url.toString();
            }
          `,
        }}
      />
    </div>
  );
};
