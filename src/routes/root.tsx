import { Layout } from "../layout";
import type { DefaultContext } from "../utils";
import { cms } from "../collections";
import { Brick, BrickPile, BrickRow, TypeBrick, brickColors } from "../components/bricks";
import { useTranslation } from "../translation";
import { entityPath } from "../urls";

// What the wiki is about, each with a brick of its own
const cards = [
  { type: "set", title: "home.browseSets", brief: "home.browseSetsBrief", border: "border-red-200 hover:border-red-400" },
  { type: "brand", title: "home.learnBrands", brief: "home.learnBrandsBrief", border: "border-yellow-200 hover:border-yellow-400" },
  { type: "wiki", title: "home.exploreBricks", brief: "home.exploreBricksBrief", border: "border-blue-200 hover:border-blue-400" },
] as const;

export const handleRootPage = async (c: DefaultContext) => {
  const user = c.get("user");
  const { t, url } = useTranslation(c);

  // The most recently changed sets and brands
  const sections = await Promise.all(
    ([["set", "home.latestSets"], ["brand", "home.brands"]] as const).map(async ([type, heading]) => ({
      type,
      heading,
      entries: await cms.list({ type, sort: "-updatedAt", limit: 3 }),
    })),
  );

  return c.render(
    <Layout context={c}>
      <main>
        <div class="overflow-hidden rounded-lg border bg-white">
          <div class="flex items-center gap-4 p-4 sm:gap-8 sm:p-6">
            <div class="min-w-0 flex-1">
              <h1 class="text-3xl font-serif sm:text-4xl">{t("home.welcome")}</h1>
              <p class="mt-3 text-pretty">{t("home.description")}</p>
            </div>
            <BrickPile class="w-20 shrink-0 self-end sm:w-40" />
          </div>
          <BrickRow />
        </div>

        <ul class="mt-6 grid list-none gap-4 space-y-0 p-0 sm:grid-cols-3">
          {cards.map(({ type, title, brief, border }) => (
            <li>
              <a
                href={url(`/entities/search?entity_type=${type}`)}
                class={`group block h-full rounded-lg border-2 border-b-4 bg-white p-4 hover:no-underline motion-safe:transition-transform motion-safe:hover:-translate-y-1 ${border}`}
              >
                <TypeBrick
                  type={type}
                  class="h-7 origin-bottom-left motion-safe:transition-transform motion-safe:group-hover:-rotate-12"
                />
                <span class="mt-3 block font-serif text-xl">{t(title)}</span>
                <span class="mt-1 block text-sm text-pretty text-gray-700">{t(brief)}</span>
              </a>
            </li>
          ))}
        </ul>

        <div class="grid gap-x-8 md:grid-cols-2">
          {sections.map(({ type, heading, entries }) => (
            <section id={`${type}s`} class="mt-8">
              <div class="pb-2 mb-3 border-b flex flex-wrap items-center gap-x-4">
                <h2 class="text-2xl font-serif">{t(heading)}</h2>
                <a class="inline-flex min-h-11 items-center text-sm" href={url(`/entities/search?entity_type=${type}`)}>
                  {t("action.seeAll")}
                </a>
              </div>
              <ul class="list-none space-y-1 p-0">
                {entries.map((entry, index) => (
                  <li class="flex items-center gap-2">
                    <Brick studs={1} color={brickColors[index % brickColors.length]} class="h-4 shrink-0" />
                    <a href={url(entityPath(entry))}>{entry.title}</a>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </main>
    </Layout>,
  );
};
