import type { PropsWithChildren } from "hono/jsx";
import { html } from "hono/html";
import type { User } from "./database";
import { assetUrl } from "./assets";
import { LanguageSwitcher } from "./components/language-switcher";
import { useTranslation } from "./translation";
import { DefaultContext } from "./utils";

const commitId = (process.env.COMMIT_ID ?? "unknown").slice(0, 7);
const githubUrl = process.env.GITHUB_URL ?? "https://github.com/BergerAPI/wikibricks";

export const Layout = ({
  children,
  title,
  user,
  context,
  script,
}: PropsWithChildren & {
  title?: string;
  user?: User | null;
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
        <link rel="stylesheet" href={assetUrl("global.css")} />
        <script type="module" src={assetUrl("src/client/site.ts")}></script>
        <title>{title ?? t("site.title")}</title>
        <link
          rel="icon"
          href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>😳</text></svg>"
        />
      </head>
      <body data-include-script={script ? `pages/${script}` : undefined}>
        <div class="container bg-white m-auto px-4 sm:px-6 lg:px-8">
          <header class="py-3 mb-5 sm:mb-8">
            <div class="flex flex-wrap items-center gap-x-3 gap-y-3 md:gap-x-6">
              <a href="/" class="inline-flex min-h-11 items-center font-serif text-black text-xl">
                {t("site.tagline")}
              </a>
              <form role="search" method="get" action="/entities/search" class="order-last flex w-full md:order-none md:w-auto md:flex-1 md:max-w-md">
                <label for="search" class="sr-only">
                  {t("nav.search")}
                </label>
                <input
                  id="search"
                  name="name"
                  type="search"
                  class="min-w-0 w-full flex-1 px-2 border"
                  placeholder={t("nav.search.placeholder")}
                />
                <input type="hidden" name="entity_type" value="all" />
                <button
                  type="submit"
                  class="shrink-0 border font-semibold bg-gray-200 px-3"
                >
                  {t("nav.search.button")}
                </button>
              </form>
              <nav class="ml-auto flex max-w-full flex-wrap items-center justify-end gap-x-3 text-sm [&>a]:inline-flex [&>a]:min-h-11 [&>a]:items-center [&>a]:break-all">
                {!user ? (
                  <>
                    <a href="/register">{t("nav.register")}</a>
                    <a href="/login">{t("nav.login")}</a>
                  </>
                ) : (
                  <>
                    <a href={`/users/${user.id}`}>{user.username}</a>
                    <form method="post" action="/logout" class="inline">
                      <button type="submit" class="border-0 px-0 text-sm text-blue-800 hover:underline">
                        {t("nav.logout")}
                      </button>
                    </form>
                  </>
                )}
              </nav>
            </div>
          </header>
          <div class="block xl:grid xl:grid-cols-[200px_minmax(0,1fr)_200px]">
            <aside class="left-sidebar"></aside>
            {children}
            <aside class="right-sidebar"></aside>
          </div>
          <footer class="py-4 mt-12 border-t">
            <div class="container mx-auto text-center text-sm text-gray-600">
              <p>{t("footer.content")}</p>
              <nav aria-label={t("footer.legal")} class="mt-2 flex flex-wrap justify-center gap-x-4 [&>a]:inline-flex [&>a]:min-h-11 [&>a]:items-center">
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
                  href={`${githubUrl}/commit/${commitId}`}
                  class="underline text-gray-500 hover:text-gray-800"
                  target="_blank"
                  rel="noopener noreferrer"
                  title="View commit on GitHub"
                >
                  #{commitId}
                </a>
              </p>
            </div>
          </footer>
        </div>
      </body>
    </html>
  )}`;
};
