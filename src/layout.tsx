import type { PropsWithChildren } from "hono/jsx";
import { html } from "hono/html";
import type { User } from "./database";
import { assetUrl } from "./assets";
import { LanguageSwitcher } from "./components/language-switcher";
import { useTranslation } from "./translation";
import { DefaultContext } from "./utils";

// Get commit ID from environment with development fallback
const getCommitId = () => {
  const commitId = process.env.COMMIT_ID;
  if (commitId && commitId !== "unknown") {
    return commitId.length > 7 ? commitId.substring(0, 7) : commitId;
  }

  return "unknown";
};

const shortCommitId = getCommitId();

const getGithubUrl = () => {
  const base =
    process.env.GITHUB_URL ?? "https://github.com/BergerAPI/wikibricks";
  return base.startsWith("https://") ? base : "https://github.com/BergerAPI/wikibricks";
};

export const Layout = ({
  children,
  title,
  user,
  context,
  script,
}: PropsWithChildren & {
  title?: string | undefined;
  user?: User | null | undefined;
  context: DefaultContext;
  script?: string;
}) => {
  const { t, language } = useTranslation(context);

  return html`<!DOCTYPE html>${(
    <html lang={language}>
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <meta name="description" content={t("site.tagline")} />
        <meta http-equiv="X-UA-Compatible" content="ie=edge" />
        <link rel="stylesheet" href={assetUrl("styles.css")} />
        {script && <script type="module" src={assetUrl(`${script}.js`)}></script>}
        <title>{title ?? t("site.title")}</title>
        <link
          rel="icon"
          href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>😳</text></svg>"
        />
      </head>
      <body>
        <div class="container bg-white m-auto px-8">
          <header class="py-3 mb-8">
            <div class="container mx-auto flex justify-between items-center">
              <div class="flex gap-8">
                <a href="/" class="font-serif text-black text-medium text-xl">
                  {t("site.tagline")}
                </a>
                <form method="get" action="/entities/search" class="hidden md:flex">
                  <label for="search" class="sr-only">
                    {t("nav.search")}
                  </label>
                  <input
                    id="search"
                    name="name"
                    class="py-1.5 px-1 border mr-0"
                    placeholder={t("nav.search.placeholder")}
                  />
                  <input type="hidden" name="entity_type" value="all" />
                  <button
                    type="submit"
                    class="border font-semibold bg-gray-200 px-1 py-1.5 ml-0"
                  >
                    {t("nav.search.button")}
                  </button>
                </form>
              </div>
              <div class="flex items-center space-x-2">
                <nav class="space-x-2 [&>a]:text-sm">
                  {user === undefined || user === null ? (
                    <>
                      <a href="/register">{t("nav.register")}</a>
                      <a href="/login">{t("nav.login")}</a>
                    </>
                  ) : (
                    <>
                      <a href={`/users/${user.id}`}>{user.username}</a>
                      <form method="post" action="/logout" class="inline">
                        <button type="submit" class="border-0! p-0! text-sm text-blue-800 hover:underline">
                          {t("nav.logout")}
                        </button>
                      </form>
                    </>
                  )}
                </nav>
              </div>
            </div>
          </header>
          <div class="block xl:grid grid-cols-[200px_1fr_200px]">
            <aside class="left-sidebar"></aside>
            {children}
            <aside class="right-sidebar"></aside>
          </div>
          <footer class="py-4 mt-12 border-t">
            <div class="container mx-auto text-center text-sm text-gray-600">
              <p>{t("footer.content")}</p>
              <nav aria-label={t("footer.legal")} class="mt-2 flex flex-wrap justify-center gap-x-4 gap-y-1">
                <a href="/datenschutz">{t("footer.privacy")}</a>
                <a href="/impressum">{t("footer.imprint")}</a>
                <a href="/nutzungsbedingungen">{t("footer.terms")}</a>
              </nav>
              <div class="mt-2">
                <LanguageSwitcher context={context} />
              </div>
              <p class="text-xs text-gray-500 mt-1">
                {t("footer.version")}:{" "}
                <a
                  href={`${getGithubUrl()}/commit/${shortCommitId}`}
                  class="underline text-gray-500 hover:text-gray-800"
                  target="_blank"
                  rel="noopener noreferrer"
                  title="View commit on GitHub"
                >
                  #{shortCommitId}
                </a>
              </p>
            </div>
          </footer>
        </div>
      </body>
    </html>
  )}`;
};
