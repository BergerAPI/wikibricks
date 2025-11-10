import { type Context } from "hono";
import { Layout } from "../layout";
import type { DefaultContext } from "../utils";
import { sql, type BrandView, type SetView, type WikiView } from "../database";
import { useTranslation } from "../translation";

export const handleRootPage = async (c: DefaultContext) => {
  const user = c.get("user");
  const { t } = useTranslation(c);

  const [sets, brands, wikis] = await sql.begin(async (sql) => {
    const sets = await sql<SetView[]>`SELECT * FROM set_view LIMIT 3;`;
    const brands = await sql<BrandView[]>`SELECT * FROM brand_view LIMIT 3;`;
    const wikis = await sql<WikiView[]>`SELECT * FROM wiki_view LIMIT 3;`;

    return [sets, brands, wikis];
  });

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

        <section id="sets" class="mt-8">
          <div class="pb-2 mb-3 border-b flex items-center gap-4">
            <h2 class="text-2xl font-serif">{t("home.latestSets")}</h2>
            <a class="text-sm" href="/entities/search?entity_type=set">
              {t("action.seeAll")}
            </a>
          </div>
          <ul>
            {sets.map((it) => (
              <li>
                <a href={`/entities/${it.id}`}>{it.name}</a>
              </li>
            ))}
          </ul>
        </section>

        <section id="brands" class="mt-8">
          <div class="pb-2 mb-3 border-b flex items-center gap-4">
            <h2 class="text-2xl font-serif">{t("home.brands")}</h2>
            <a class="text-sm" href="/entities/search?entity_type=brand">
              {t("action.seeAll")}
            </a>
          </div>
          <ul>
            {brands.map((it) => (
              <li>
                <a href={`/entities/${it.id}`}>{it.name}</a>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </Layout>,
  );
};
