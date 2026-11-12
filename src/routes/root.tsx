import { Layout } from "../layout";
import type { DefaultContext } from "../utils";
import { cms } from "../collections";
import { useTranslation } from "../translation";

export const handleRootPage = async (c: DefaultContext) => {
  const user = c.get("user");
  const { t } = useTranslation(c);

  // The most recently changed sets and brands
  const sections = await Promise.all(
    ([["set", "home.latestSets"], ["brand", "home.brands"]] as const).map(async ([type, heading]) => ({
      type,
      heading,
      entries: await cms.list({ type, sort: "-updatedAt", limit: 3 }),
    })),
  );

  return c.render(
    <Layout context={c} user={user}>
      <main>
        <h1 class="text-3xl font-serif pb-2 mb-3 border-b">
          {t("site.tagline")}
        </h1>

        <p class="font-bold">{t("home.welcome")}</p>

        <p class="text-pretty">{t("home.description")}</p>

        <ul class="mt-2">
          <li>
            <span class="font-semibold">{t("home.browseSets")}</span>
            {t("home.browseSetsBrief")}
          </li>
          <li>
            <span class="font-semibold">{t("home.learnBrands")}</span>
            {t("home.learnBrandsBrief")}
          </li>
          <li>
            <span class="font-semibold">{t("home.exploreBricks")}</span>
            {t("home.exploreBricksBrief")}
          </li>
        </ul>

        {sections.map(({ type, heading, entries }) => (
          <section id={`${type}s`} class="mt-8">
            <div class="pb-2 mb-3 border-b flex flex-wrap items-center gap-x-4">
              <h2 class="text-2xl font-serif">{t(heading)}</h2>
              <a class="inline-flex min-h-11 items-center text-sm" href={`/entities/search?entity_type=${type}`}>
                {t("action.seeAll")}
              </a>
            </div>
            <ul>
              {entries.map((entry) => (
                <li>
                  <a href={`/entities/${entry.entityId}`}>{entry.title}</a>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </main>
    </Layout>,
  );
};
