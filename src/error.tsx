import { Layout } from "./layout";
import { useTranslation } from "./translation";
import type { DefaultContext } from "./utils";

const ErrorPage = ({ c, notFound }: { c: DefaultContext; notFound: boolean }) => {
  const { t } = useTranslation(c);

  return (
    <Layout context={c} user={c.get("user")}>
      <main>
        <h1 class="text-3xl font-serif pb-2 mb-3 border-b">
          {t(notFound ? "error.pageNotFound" : "error.somethingWentWrong")}
        </h1>
        <p class="pb-2">
          {t(notFound ? "error.pageNotFoundMessage" : "error.unexpectedErrorMessage")}
        </p>
        <a href="/">{t("action.returnHome")}</a>
      </main>
    </Layout>
  );
};

export const handleError = (err: Error, c: DefaultContext) => {
  console.error(err);

  // Requests made by our scripts show the message in an alert, so they get plain text
  if (c.req.method !== "GET") return c.text("Something went wrong", 500);

  return c.html(<ErrorPage c={c} notFound={false} />, 500);
};

export const handleNotFound = (c: DefaultContext) => {
  return c.html(<ErrorPage c={c} notFound />, 404);
};
