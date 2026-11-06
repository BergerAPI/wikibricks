import type { User } from "./database";
import { Layout } from "./layout";
import type { DefaultContext } from "./utils";
import { useTranslation } from "./translation";

const ErrorPage = ({ context }: { context: DefaultContext }) => {
  const { t } = useTranslation(context);

  const statusCode = context.res.status || 500;
  const title =
    statusCode === 404
      ? t("error.pageNotFound")
      : t("error.somethingWentWrong");
  const message =
    statusCode === 404
      ? t("error.pageNotFoundMessage")
      : t("error.unexpectedErrorMessage");

  return (
    <Layout context={context} user={context.get("user")}>
      <main>
        <h1 class="text-3xl font-serif pb-2 mb-3 border-b">Error: {title}</h1>
        <p class="pb-2">{message}</p>
        <a href="/">{t("action.returnHome")}</a>
      </main>
    </Layout>
  );
};

export const handleError = (err: Error, c: DefaultContext) => {
  // TODO: Log error to a service like Sentry
  if (c.res.status < 400) c.status(500);

  console.error(err);

  return c.html(<ErrorPage context={c} />);
};

export const handleNotFound = (c: DefaultContext) => {
  c.status(404);

  return c.html(<ErrorPage context={c} />);
};
