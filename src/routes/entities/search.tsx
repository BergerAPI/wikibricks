import { cms, fieldsOf } from "../../collections";
import { EntityFieldInput } from "../../components/entity-field";
import { Table, TableHead } from "../../components/table";
import { loadFieldOptions } from "../../fields";
import { Layout } from "../../layout";
import { readSearchFilters, searchableFields } from "../../search-filters";
import { useTranslation } from "../../translation";
import type { DefaultContext } from "../../utils";

const PAGE_SIZE = 10;

export const handleSearchPage = async (c: DefaultContext) => {
  const user = c.get("user");
  const { t, formatDate } = useTranslation(c);

  const requestedPage = Math.floor(Number(c.req.query("page")));
  const page = requestedPage > 0 && Number.isSafeInteger(requestedPage * PAGE_SIZE) ? requestedPage : 0;
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
  const searchUrl = (query: Record<string, string>) =>
    `/entities/search?${new URLSearchParams(Object.entries(query).filter(([, value]) => value))}`;
  const typeUrl = (type: string, name = "") =>
    searchUrl({ entity_type: type === "all" ? "" : type, name });
  const pageUrl = (page: number) =>
    searchUrl({ ...Object.fromEntries(filters.params), entity_type: entityType, name, page: page ? String(page) : "" });

  // A bookmark can point past the last page after the result count changes.
  if (page > 0 && results.length === 0 && (await cms.list({ ...query, limit: 1 })).length > 0)
    return c.redirect(pageUrl(0));

  return c.render(
    <Layout context={c} user={user}>
      <main class="min-w-0">
        <div class="flex flex-wrap justify-between items-center gap-x-4 gap-y-2 pb-2 mb-3 border-b">
          <h1 class="text-3xl font-serif">{t("entities.title")}</h1>
          <div class="flex flex-wrap items-center gap-x-4 [&>a]:inline-flex [&>a]:min-h-11 [&>a]:items-center">
            {user && <a href="/entities/new">{t("action.addEntity")}</a>}
          </div>
        </div>

        <nav aria-label={t("entities.entityTypeLabel")} class="mb-3 flex flex-wrap gap-x-1">
          {(["all", ...cms.types] as const).map((option) => (
            <a
              href={typeUrl(option, name)}
              aria-current={entityType === option ? "page" : undefined}
              class="inline-flex min-h-11 items-center border-b-2 border-transparent px-3 aria-[current]:border-blue-800 aria-[current]:font-semibold aria-[current]:text-black"
            >
              {t(`entityType.${option}`)}
            </a>
          ))}
        </nav>

        <form method="get" action="/entities/search" class="mb-4 flex flex-wrap items-center gap-x-4 gap-y-3">
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
            <div class="grid w-full gap-3 border bg-background p-3 sm:grid-cols-2 lg:grid-cols-3">
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
          )}

          <button type="submit" class="border-gray-300 bg-gray-100 hover:bg-gray-200">
            {t("action.search")}
          </button>
          {(name || filters.params.size > 0) && (
            <a href={typeUrl(entityType)}>{t("entities.clearSearch")}</a>
          )}
        </form>

        {results.length === 0 ? (
          <p class="border bg-background p-4">
            {t("entities.noResults")}{" "}
            <a href={typeUrl(entityType)}>{t("entities.clearSearch")}</a>
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
          {items.length > PAGE_SIZE && (
            <a rel="next" href={pageUrl(page + 1)}>{t("action.next")}</a>
          )}
        </div>
      </main>
    </Layout>,
  );
};
