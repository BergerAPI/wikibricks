import { getAvailableLanguages, useTranslation, type Language } from "../translation";
import type { DefaultContext } from "../utils";

const languageNames: Record<Language, string> = {
  en: "English",
  de: "Deutsch",
};

// Each language is its own submit button, so a click switches right away
export const LanguageSwitcher = ({ context }: { context: DefaultContext }) => {
  const { language, t } = useTranslation(context);
  const { pathname, search } = new URL(context.req.url);

  return (
    <form method="post" action="/language" aria-label={t("nav.language")} class="inline-flex items-center gap-3 text-sm">
      <input type="hidden" name="returnTo" value={pathname + search} />
      {getAvailableLanguages().map((option) =>
        option === language ? (
          <span lang={option} aria-current="true" class="font-semibold">
            {languageNames[option]}
          </span>
        ) : (
          <button
            type="submit"
            name="lang"
            value={option}
            lang={option}
            class="border-0 px-2 text-blue-800 hover:underline"
          >
            {languageNames[option]}
          </button>
        ),
      )}
    </form>
  );
};
