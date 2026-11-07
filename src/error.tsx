import { Layout } from "./layout";
import { useTranslation } from "./translation";
import type { DefaultContext } from "./utils";

const ErrorPage = ({ c }: { c: DefaultContext }) => {
  const { t } = useTranslation(c);
  const notFound = c.res.status === 404;

  return (
    <Layout context={c} user={c.get("user")}>
      <main>
        <h1 class="text-3xl font-serif pb-2 mb-3 border-b">
          Error: {t(notFound ? "error.pageNotFound" : "error.somethingWentWrong")}
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

  c.status(500);
  return c.html(<ErrorPage c={c} />);
};

export const handleNotFound = (c: DefaultContext) => {
  c.status(404);
  return c.html(<ErrorPage c={c} />);
};
