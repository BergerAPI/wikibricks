import type { StatusCode } from "hono/utils/http-status";
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
        <h1 class="text-3xl font-serif pb-2 mb-3 border-b">Error:{title}</h1>
        <p class="pb-2">{message}</p>
        <a href="/">{t("action.returnHome")}</a>
      </main>
    </Layout>
  );
};

export const handleError = (err: Error, c: DefaultContext) => {
  // TODO: Log error to a service like Sentry
  c.status(c.res.status as StatusCode);

  console.error(err);

  return c.html(<ErrorPage context={c} />);
};

export const handleNotFound = async (c: DefaultContext, next: any) => {
  if (
    c.res.status.toString().startsWith("2") ||
    c.res.status.toString().startsWith("3")
  )
    return await next();

  c.status(c.res.status as StatusCode);

  return c.html(<ErrorPage context={c} />);
};
