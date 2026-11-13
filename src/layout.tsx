import type { PropsWithChildren } from "hono/jsx";
import { html } from "hono/html";
import { assetUrl } from "./assets";
import { Brick } from "./components/bricks";
import {
  getAvailableLanguages,
  localPath,
  stripLanguage,
  useTranslation,
  type Language,
} from "./translation";
import { siteUrl } from "./urls";
import { isAdmin, isModerator, type DefaultContext } from "./utils";

const commitId = (process.env.COMMIT_ID ?? "unknown").slice(0, 7);
const githubUrl =
  process.env.GITHUB_URL ?? "https://github.com/BergerAPI/wikibricks";

const languageNames: Record<Language, string> = {
  en: "English",
  de: "Deutsch",
};

// Each language is its own submit button, so a click switches right away
const LanguageSwitcher = ({ context }: { context: DefaultContext }) => {
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
          <button type="submit" name="lang" value={option} lang={option} class="button-link px-2">
            {languageNames[option]}
          </button>
        ),
      )}
    </form>
  );
};

export const Layout = ({
  children,
  title,
  description,
  noindex,
  context,
  page,
}: PropsWithChildren & {
  /** The page's name, followed by the site's name in the browser tab */
  title?: string;
  description?: string;
  /** Keeps pages out of search engines that aren't content, like forms and old versions */
  noindex?: boolean;
  context: DefaultContext;
  /** Sets up the scripted parts of a page, like its forms */
  page?: "delete" | "edit-entity" | "new-entity" | "review-entity";
}) => {
  const { t, url, language } = useTranslation(context);
  const user = context.get("user");
  const notifications = context.get("notifications") ?? 0;
  const { pathname, search } = new URL(context.req.url);
  const path = stripLanguage(pathname);
  // Logging in leads back to the page it started from
  const loginUrl = ["/", "/login", "/register"].includes(path)
    ? url("/login")
    : `${url("/login")}?redirect=${encodeURIComponent(pathname + search)}`;

  return html`<!DOCTYPE html>${(
      <html lang={language}>
        <head>
          <meta charset="UTF-8" />
          <meta
            name="viewport"
            content="width=device-width, initial-scale=1.0"
          />
          <meta name="description" content={description || t("site.tagline")} />
          {noindex ? (
            <meta name="robots" content="noindex" />
          ) : (
            <>
              <link rel="canonical" href={siteUrl(context, url(path))} />
              {getAvailableLanguages().map((other) => (
                <link
                  rel="alternate"
                  hreflang={other}
                  href={siteUrl(context, localPath(other, path))}
                />
              ))}
              <link
                rel="alternate"
                hreflang="x-default"
                href={siteUrl(context, localPath("en", path))}
              />
            </>
          )}
          <link rel="stylesheet" href={assetUrl("global.css")} />
          <script type="module" src={assetUrl("src/client/site.ts")}></script>
          <title>{title ? `${title} | ${t("site.tagline")}` : t("site.title")}</title>
          <link
            rel="icon"
            href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40' fill='%23ef4444'><rect x='5' y='5' width='11' height='8' rx='2'/><rect x='24' y='5' width='11' height='8' rx='2'/><rect y='11' width='40' height='25' rx='3'/></svg>"
          />
        </head>
        <body data-page={page}>
          <div class="container bg-white m-auto px-4 sm:px-6 lg:px-8">
            <header class="py-3 mb-5 sm:mb-8">
              <div class="flex flex-wrap items-center gap-x-3 gap-y-3 md:gap-x-6">
                <a
                  href={url("/")}
                  class="inline-flex min-h-11 items-center gap-2 font-serif text-black text-xl"
                >
                  <Brick color="fill-red-500" class="h-5" />
                  {t("site.tagline")}
                </a>
                <form
                  role="search"
                  method="get"
                  action={url("/entities/search")}
                  class="order-last flex w-full md:order-0 md:w-auto md:flex-1 md:max-w-md"
                >
                  <label for="search" class="sr-only">
                    {t("nav.search")}
                  </label>
                  <input
                    id="search"
                    name="name"
                    type="search"
                    class="min-w-0 w-full flex-1 rounded-r-none px-2"
                    placeholder={t("nav.search.placeholder")}
                  />
                  <button type="submit" class="button-secondary shrink-0 rounded-l-none font-semibold">
                    {t("nav.search.button")}
                  </button>
                </form>
                <nav class="ml-auto flex max-w-full flex-wrap items-center justify-end gap-x-3 text-sm [&>a]:inline-flex [&>a]:min-h-11 [&>a]:items-center [&>a]:break-all">
                  {!user ? (
                    <>
                      <a href={url("/register")}>{t("nav.register")}</a>
                      <a href={loginUrl}>{t("nav.login")}</a>
                    </>
                  ) : (
                    <>
                      <a
                        href={url("/notifications")}
                        class="relative min-w-11 justify-center"
                        aria-label={
                          notifications > 0
                            ? t("nav.notificationsNew", {
                                count: String(notifications),
                              })
                            : t("notify.title")
                        }
                        title={t("notify.title")}
                      >
                        <svg
                          viewBox="0 0 24 24"
                          class="size-5 fill-none stroke-current stroke-2"
                          aria-hidden="true"
                        >
                          <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0"
                          />
                        </svg>
                        {notifications > 0 && (
                          <span class="absolute top-1.5 right-0 min-w-4 rounded-full bg-red-600 px-1 text-center text-xs leading-4 font-semibold text-white">
                            {notifications}
                          </span>
                        )}
                      </a>
                      {isAdmin(user) ? (
                        <a href={url("/admin")}>{t("nav.admin")}</a>
                      ) : (
                        isModerator(user) && (
                          <a href={url("/changes")}>
                            {t("entities.changeRequests")}
                          </a>
                        )
                      )}
                      <a href={url(`/users/${user.id}`)}>{user.username}</a>
                      <form
                        method="post"
                        action={url("/logout")}
                        class="inline"
                      >
                        <button type="submit" class="button-link text-sm">
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
                <nav
                  aria-label={t("footer.legal")}
                  class="mt-2 flex flex-wrap justify-center gap-x-4 [&>a]:inline-flex [&>a]:min-h-11 [&>a]:items-center"
                >
                  <a href={url("/privacy")}>{t("footer.privacy")}</a>
                  <a href={url("/imprint")}>{t("footer.imprint")}</a>
                  <a href={url("/terms")}>{t("footer.terms")}</a>
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
