import { cms } from "../../collections";
import { Table, TableHead } from "../../components/table";
import { Layout } from "../../layout";
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

  const { total, items: results } = await cms.find({
    type: entityType === "all" ? undefined : entityType,
    where: name ? { title: { contains: name } } : {},
    sort: "-createdAt",
    offset: page * PAGE_SIZE,
    limit: PAGE_SIZE,
  });

  const pageUrl = (page: number) =>
    `/entities/search?${new URLSearchParams({ page: String(page), entity_type: entityType, name })}`;

  return c.render(
    <Layout context={c} user={user}>
      <main class="min-w-0">
        <div class="flex justify-between items-center pb-2 mb-3 border-b">
          <h1 class="text-3xl font-serif">{t("entities.title")}</h1>
          <div class="space-x-2">
            {isModerator(user) && <a href="/changes">{t("entities.changeRequests")}</a>}
            {user && <a href="/entities/new">{t("action.addEntity")}</a>}
          </div>
        </div>

        <form method="get" action="/entities/search" class="mb-4 w-[50%] space-y-2">
          <div class="flex gap-2">
            <label class="sr-only" for="name">
              Name:
            </label>
            <input
              type="text"
              id="name"
              name="name"
              value={name}
              class="border border-gray-300 p-1 w-full"
              placeholder={t("entities.searchByName")}
            />
            <button
              type="submit"
              class="border border-gray-300 bg-gray-100 px-3 py-1 text-sm hover:bg-gray-200"
            >
              {t("action.search")}
            </button>
          </div>

          <details>
            <summary class="cursor-pointer font-semibold p-2 border bg-background">
              {t("entities.advancedSearch")}
            </summary>
            <div class="border border-t-0 p-2">
              <label class="block text-sm text-gray-600 mb-1">{t("entities.entityType")}</label>
              <select name="entity_type" class="border border-gray-300 w-full p-1">
                {(["all", ...cms.types] as const).map((option) => (
                  <option value={option} selected={entityType === option}>
                    {t(`entityType.${option}`)}
                  </option>
                ))}
              </select>
            </div>
          </details>
        </form>

        <div class="min-w-full overflow-x-auto">
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
                  <td>{formatDate(result.entityCreatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </Table>

          <div class="mt-4 flex justify-center space-x-2">
            {page > 0 && <a href={pageUrl(page - 1)}>{t("action.previous")}</a>}
            {(page + 1) * PAGE_SIZE < total && (
              <a href={pageUrl(page + 1)}>{t("action.next")}</a>
            )}
          </div>
        </div>
      </main>
    </Layout>,
  );
};
