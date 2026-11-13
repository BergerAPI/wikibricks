import { BrickSpill } from "./components/bricks";
import { PageTitle } from "./components/ui";
import { Layout } from "./layout";
import { useTranslation } from "./translation";
import type { DefaultContext } from "./utils";

const ErrorPage = ({ c, notFound }: { c: DefaultContext; notFound: boolean }) => {
  const { t, url } = useTranslation(c);

  return (
    <Layout context={c} noindex>
      <main>
        <BrickSpill class="mb-4 w-44" />
        <PageTitle>{t(notFound ? "error.pageNotFound" : "error.somethingWentWrong")}</PageTitle>
        <p class="pb-2">
          {t(notFound ? "error.pageNotFoundMessage" : "error.unexpectedErrorMessage")}
        </p>
        <a href={url("/")}>{t("action.returnHome")}</a>
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
