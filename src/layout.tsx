import type { PropsWithChildren } from "hono/jsx";
import fs from "fs";
import type { User } from "./database";
import { t, useTranslation } from "./translation";
import { LanguageSwitcher } from "./components/language-switcher";
import { DefaultContext } from "./utils";

const styles =
  process.env.NODE_ENV === "production"
    ? fs.readFileSync("/app/dist/public/styles.css", "utf8")
    : fs.readFileSync("./public/styles.css", "utf-8");

export const Layout = ({
  children,
  title,
  user,
  context,
}: PropsWithChildren & {
  title?: string | undefined;
  user?: User | null | undefined;
  context: DefaultContext;
}) => {
  const { t } = useTranslation(context);

  return (
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <meta http-equiv="X-UA-Compatible" content="ie=edge" />
        <style dangerouslySetInnerHTML={{ __html: styles }}></style>
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
                <div class="hidden md:flex">
                  <label for="search" class="sr-only">
                    {t("nav.search")}
                  </label>
                  <input
                    id="search"
                    class="py-1.5 px-1 border mr-0"
                    placeholder={t("nav.search.placeholder")}
                  />
                  <button
                    class="border font-semibold bg-gray-200 px-1 py-1.5 ml-0"
                    id="search-button"
                  >
                    {t("nav.search.button")}
                  </button>
                </div>
              </div>
              <div class="flex items-center space-x-2">
                <nav class="space-x-2 [&>a]:text-sm">
                  {(user === undefined || user === null) ? (
                    <>
                      <a href="/register">{t("nav.register")}</a>
                      <a href="/login">{t("nav.login")}</a>
                    </>
                  ) : (
                    <>
                      <a href={`/users/${user.id}`}>{user.username}</a>
                      <a id="logout-button">{t("nav.logout")}</a>
                    </>
                  )}
                </nav>
              </div>
            </div>
          </header>
          <script
            dangerouslySetInnerHTML={{
              __html: `
document.addEventListener('DOMContentLoaded', () => {
  const searchInput = document.getElementById('search');
  const searchButton = document.getElementById('search-button');
  const logoutButton = document.getElementById('logout-button');

  searchButton.addEventListener('click', () => {
    const query = searchInput.value;
    window.location.href = "/search?name=" + encodeURIComponent(query) + "&entity_type=all";
  });

  logoutButton.addEventListener('click', () => {
    fetch('/logout', { method: 'POST' })
      .then(() => window.location.href = '/')
      .catch(error => console.error('Logout failed:', error));
  });
});
            `,
            }}
          ></script>
          <div class="block xl:grid grid-cols-[200px_1fr_200px]">
            <aside class="left-sidebar"></aside>
            {children}
            <aside class="right-sidebar"></aside>
          </div>
          <footer class="py-4 mt-12 border-t">
            <div class="container mx-auto text-center text-sm text-gray-600">
              <p>
                {t("footer.content")} {t("footer.termsPrivacy")}
              </p>
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
};
