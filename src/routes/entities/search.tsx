import { cms, fieldsOf } from "../../collections";
import { BrickSpill, TypeBrick } from "../../components/bricks";
import { EntityFieldInput } from "../../components/entity-field";
import { Notice, PageTitle, Pager, Row, RowList, Tabs } from "../../components/ui";
import { loadFieldOptions } from "../../fields";
import { Layout } from "../../layout";
import { readSearchFilters, searchableFields } from "../../search-filters";
import { useTranslation } from "../../translation";
import { entityPath, pageLink, readPage } from "../../urls";
import type { DefaultContext } from "../../utils";

const PAGE_SIZE = 10;

export const handleSearchPage = async (c: DefaultContext) => {
  const user = c.get("user");
  const { t, url, formatDate } = useTranslation(c);

  const page = readPage(c, PAGE_SIZE);
  const rawType = c.req.query("entity_type") ?? "all";
  const entityType = cms.isType(rawType) ? rawType : "all";
  const name = (c.req.query("name") ?? "").slice(0, 64);
  const fields = entityType === "all" ? {} : searchableFields(fieldsOf(entityType));
  let filters;
  try {
    filters = readSearchFilters(fields, new URL(c.req.url).searchParams);
  } catch {
    return c.text(t("entities.invalidFilter"), 400);
  }
  // Looked-up relations only list the entry that is currently selected.
  const selected = Object.fromEntries(Object.keys(fields).map((key) => [key, filters.params.get(`filter.${key}`)]));
  const query = {
    type: entityType === "all" ? undefined : entityType,
    where: { and: [name ? { title: { contains: name } } : {}, filters.where] },
    sort: "-createdAt",
  };
  const [items, options] = await Promise.all([
    cms.list({ ...query, offset: page * PAGE_SIZE, limit: PAGE_SIZE + 1 }),
    entityType === "all" ? undefined : loadFieldOptions(entityType, selected),
  ]);
  const results = items.slice(0, PAGE_SIZE);

  // Links within the search leave out whatever is empty.
  const searchUrl = (query: Record<string, string>, page = 0) => url(pageLink("/entities/search", query, page));
  const typeUrl = (type: string, name = "") =>
    searchUrl({ entity_type: type === "all" ? "" : type, name });
  const pageUrl = (page: number) =>
    searchUrl({ ...Object.fromEntries(filters.params), entity_type: entityType === "all" ? "" : entityType, name }, page);

  // A bookmark can point past the last page after the result count changes.
  if (page > 0 && results.length === 0 && (await cms.list({ ...query, limit: 1 })).length > 0)
    return c.redirect(pageUrl(0));

  return c.render(
    <Layout context={c} title={`${t("entities.title")}`} noindex>
      <main class="min-w-0">
        <PageTitle
          actions={entityType === "all"
            ? <a href={url("/entities/new")}>{t("action.addEntity")}</a>
            : <a href={url(`/entities/new?type=${entityType}`)}>{t("action.addType", { type: t(`entityType.${entityType}`) })}</a>}
        >
          {t("entities.title")}
        </PageTitle>

        <Tabs
          label={t("entities.entityTypeLabel")}
          tabs={(["all", ...cms.types] as const).map((option) => ({
            href: typeUrl(option, name),
            current: entityType === option,
            children: <>{option !== "all" && <TypeBrick type={option} class="h-3.5" />}{t(`entityType.${option}`)}</>,
          }))}
        />

        <form method="get" action={url("/entities/search")} class="mb-4 flex flex-wrap items-center gap-x-4 gap-y-3">
          {entityType !== "all" && <input type="hidden" name="entity_type" value={entityType} />}
          <label class="sr-only" for="name">
            {t("entities.name")}
          </label>
          <input
            type="search"
            id="name"
            name="name"
            value={name}
            class="min-w-0 flex-1"
            placeholder={t("entities.searchByName")}
          />

          {Object.keys(fields).length > 0 && (
            // Closed until used, so the results stay in view on a phone
            <details class="w-full border bg-background" open={filters.params.size > 0}>
              <summary class="cursor-pointer px-3 py-2.5 font-medium">{t("entities.filters")}</summary>
              <div class="grid gap-3 p-3 pt-0 sm:grid-cols-2 lg:grid-cols-3">
                {Object.entries(fields).map(([key, field]) => (
                  <div>
                    <label for={`filter-${key}`} class="block font-medium">{t(field.meta.label!)}</label>
                    {field.type === "number" ? (
                      <div class="mt-1 flex items-center gap-2">
                        {(["min", "max"] as const).map((bound) => (
                          <>
                            {bound === "max" && <span class="text-gray-500">–</span>}
                            <input
                              type="number"
                              step="1"
                              id={bound === "min" ? `filter-${key}` : undefined}
                              name={`filter.${key}.${bound}`}
                              value={filters.params.get(`filter.${key}.${bound}`) ?? ""}
                              placeholder={t(`entities.${bound}`)}
                              aria-label={`${t(field.meta.label!)}: ${t(`entities.${bound}`)}`}
                              class="w-full"
                            />
                          </>
                        ))}
                      </div>
                    ) : (
                      <EntityFieldInput
                        field={field}
                        t={t}
                        options={options?.[key]}
                        emptyLabel={t("entities.anyValue")}
                        id={`filter-${key}`}
                        name={`filter.${key}`}
                        value={filters.params.get(`filter.${key}`) ?? ""}
                        class="mt-1 block w-full"
                      />
                    )}
                  </div>
                ))}
              </div>
            </details>
          )}

          <button type="submit" class="button-secondary">
            {t("action.search")}
          </button>
          {(name || filters.params.size > 0) && (
            <a href={typeUrl(entityType)}>{t("entities.clearSearch")}</a>
          )}
        </form>

        {results.length === 0 ? (
          <Notice>
            <BrickSpill class="mb-3 w-36" />
            {t("entities.noResults")}{" "}
            <a href={typeUrl(entityType)}>{t("entities.clearSearch")}</a>
          </Notice>
        ) : (
          <RowList>
            {results.map((result) => (
              // The type only tells something while all types are listed
              <Row details={<>
                {entityType === "all" && <span>{t(`entityType.${result.type}`)}</span>}
                {formatDate(result.entityCreatedAt)}
              </>}>
                <a href={url(entityPath(result))}>{result.title}</a>
              </Row>
            ))}
          </RowList>
        )}

        <Pager page={page} more={items.length > PAGE_SIZE} pageUrl={pageUrl} t={t} />
      </main>
    </Layout>,
  );
};
