import { cms, fieldsOf } from "../../collections";
import { EntityFieldInput } from "../../components/entity-field";
import { Table, TableHead } from "../../components/table";
import { loadFieldOptions } from "../../fields";
import { Layout } from "../../layout";
import { readSearchFilters, searchableFields } from "../../search-filters";
import { useTranslation } from "../../translation";
import { isModerator, type DefaultContext } from "../../utils";

const PAGE_SIZE = 10;

export const handleSearchPage = async (c: DefaultContext) => {
  const user = c.get("user");
  const { t, formatDate } = useTranslation(c);

  const page = Math.max(0, Math.floor(Number(c.req.query("page")) || 0));
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
  const options = entityType === "all" ? {} : await loadFieldOptions(entityType,
    Object.fromEntries(Object.keys(fields).map((key) => [key, filters.params.get(`filter.${key}`)])),
  );

  const { total, items: results } = await cms.find({
    type: entityType === "all" ? undefined : entityType,
    where: { and: [name ? { title: { contains: name } } : {}, filters.where] },
    sort: "-createdAt",
    offset: page * PAGE_SIZE,
    limit: PAGE_SIZE,
  });

  const pageUrl = (page: number) =>
    `/entities/search?${new URLSearchParams([
      ["page", String(page)], ["entity_type", entityType], ["name", name], ...filters.params,
    ])}`;

  return c.render(
    <Layout context={c} user={user} script="search">
      <main class="min-w-0">
        <div class="flex flex-wrap justify-between items-center gap-x-4 gap-y-2 pb-2 mb-3 border-b">
          <h1 class="text-3xl font-serif">{t("entities.title")}</h1>
          <div class="flex flex-wrap items-center gap-x-4 [&>a]:inline-flex [&>a]:min-h-11 [&>a]:items-center">
            {isModerator(user) && <a href="/changes">{t("entities.changeRequests")}</a>}
            {user && <a href="/entities/new">{t("action.addEntity")}</a>}
          </div>
        </div>

        <form method="get" action="/entities/search" class="mb-4 w-full max-w-2xl space-y-2">
          <div class="flex gap-2">
            <label class="sr-only" for="name">
              {t("entities.name")}
            </label>
            <input
              type="search"
              id="name"
              name="name"
              value={name}
              class="min-w-0 flex-1 border border-gray-300"
              placeholder={t("entities.searchByName")}
            />
            <button
              type="submit"
              class="border border-gray-300 bg-gray-100 px-3 py-1 text-sm hover:bg-gray-200"
            >
              {t("action.search")}
            </button>
          </div>

          <details open={entityType !== "all"}>
            <summary class="cursor-pointer font-semibold p-2 border bg-background">
              {t("entities.advancedSearch")}
            </summary>
            <div class="border border-t-0 p-2">
              <label for="entity_type" class="block text-sm text-gray-600 mb-1">{t("entities.entityType")}</label>
              <select id="entity_type" name="entity_type" class="border border-gray-300 w-full">
                {(["all", ...cms.types] as const).map((option) => (
                  <option value={option} selected={entityType === option}>
                    {t(`entityType.${option}`)}
                  </option>
                ))}
              </select>
              <div data-specific-filters class="mt-3 grid items-start gap-3 sm:grid-cols-2 empty:hidden">
                {Object.entries(fields).map(([key, field]) =>
                  field.type === "number" ? (
                    <fieldset>
                      <legend class="mb-1 font-medium">{t(field.meta.label!)}</legend>
                      <div class="grid grid-cols-2 gap-3">
                        {(["min", "max"] as const).map((bound) => (
                          <label class="block text-sm">
                            {t(`entities.${bound}`)}
                            <input
                              type="number"
                              step="1"
                              name={`filter.${key}.${bound}`}
                              value={filters.params.get(`filter.${key}.${bound}`) ?? ""}
                              class="mt-1 block w-full"
                            />
                          </label>
                        ))}
                      </div>
                    </fieldset>
                  ) : (
                    <div>
                      <label for={`filter-${key}`} class="block font-medium">
                        {t(field.meta.label!)}
                        {field.meta.hint && ` (${t(field.meta.hint)})`}
                      </label>
                      <EntityFieldInput
                        field={field}
                        t={t}
                        options={options[key]}
                        emptyLabel={t("entities.anyValue")}
                        id={`filter-${key}`}
                        name={`filter.${key}`}
                        value={filters.params.get(`filter.${key}`) ?? ""}
                        class="mt-1 block w-full"
                      />
                    </div>
                  ),
                )}
              </div>
              <div class="mt-3 flex flex-wrap items-center gap-4">
                <button type="submit" class="bg-gray-100 hover:bg-gray-200">{t("action.search")}</button>
                <a href="/entities/search">{t("entities.clearSearch")}</a>
              </div>
            </div>
          </details>
        </form>

        {results.length === 0 ? (
          <p class="border bg-background p-4">
            {t("entities.noResults")}{" "}
            <a href="/entities/search">{t("entities.clearSearch")}</a>
          </p>
        ) : (
          <Table>
            <TableHead>
              <th>{t("entities.type")}</th>
              <th>{t("entities.name")}</th>
              <th>{t("entities.date")}</th>
            </TableHead>
            <tbody>
              {results.map((result) => (
                <tr>
                  <td>
                    <a href={`/entities/${result.entityId}`}>{t(`entityType.${result.type}`)}</a>
                  </td>
                  <td>
                    <a href={`/entities/${result.entityId}`}>{result.title}</a>
                  </td>
                  <td class="whitespace-nowrap">{formatDate(result.entityCreatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}

        <div class="mt-4 flex flex-wrap justify-center gap-3 [&>a]:inline-flex [&>a]:min-h-11 [&>a]:items-center [&>a]:border [&>a]:px-3">
          {page > 0 && <a rel="prev" href={pageUrl(page - 1)}>{t("action.previous")}</a>}
          {(page + 1) * PAGE_SIZE < total && (
            <a rel="next" href={pageUrl(page + 1)}>{t("action.next")}</a>
          )}
        </div>
      </main>
    </Layout>,
  );
};
