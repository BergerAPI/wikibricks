import { Layout } from "../../layout";
import { sql } from "../../database";
import { PermissionLevel, type DefaultContext } from "../../utils";
import { Table, TableHead } from "../../components/table";
import { t } from "../../translation";

export const handleSearchPage = async (c: DefaultContext) => {
  const user = c.get("user");

  // Fetch and parse query parameters
  let page: any = c.req.query("page");
  if (page && isNaN(Number(page))) return c.redirect("/entities/search");
  page = Number(page) || 0;

  // Default to "all" if no type is provided.
  const entityType = c.req.query("entity_type") ?? "all";
  const nameSearch = c.req.query("name") ?? "";

  const filters = [];
  if (entityType !== "all") {
    filters.push(sql`e.type = ${entityType}`);
  }
  if (nameSearch && nameSearch.length > 0) {
    filters.push(sql`e.name ILIKE ${`%${nameSearch}%`}`);
  }
  const whereClause = filters.length
    ? sql`WHERE ${filters.reduce(
        (acc, cur, idx) => (idx === 0 ? cur : sql`${acc} AND ${cur}`),
        sql``,
      )}`
    : sql``;

  const [totalCount] = await sql<{ count: number }[]>`
        SELECT COUNT(*) AS count FROM entities e
            JOIN entity_versions v ON e.head_version_id = v.id
            ${whereClause}
    `;
  const results = await sql`
        SELECT e.created_at, e.type, e.name, v.description, e.id FROM entities e
            JOIN entity_versions v ON e.head_version_id = v.id
            ${whereClause}
            LIMIT 10 OFFSET ${page * 10}
    `;

  return c.render(
    <Layout user={user}>
      <main class="min-w-0">
        <div class="flex justify-between items-center pb-2 mb-3 border-b">
          <h1 class="text-3xl font-serif">{t("entities.title")}</h1>
          <div class="space-x-2">
            {(user.permission_level ?? 0) > PermissionLevel.MODERATOR && (
              <a href="/changes">{t("entities.changeRequests")}</a>
            )}
            <a href="/entities/new">{t("action.addEntity")}</a>
          </div>
        </div>
        <form
          method="get"
          action="/entities/search"
          class="mb-4 w-[50%] space-y-2"
        >
          <div class="flex gap-2">
            <label class="sr-only" for="name">
              Name:
            </label>
            <input
              type="text"
              id="name"
              name="name"
              value={nameSearch}
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
              <label class="block text-sm text-gray-600 mb-1">
                {t("entities.entityType")}
              </label>
              <select
                name="entity_type"
                class="border border-gray-300 w-full p-1"
              >
                {["all", "set", "brand", "wiki"].map((option) => (
                  <option value={option} selected={entityType === option}>
                    {option === "all"
                      ? t("entityType.all")
                      : option === "set"
                        ? t("entityType.set")
                        : option === "brand"
                          ? t("entityType.brand")
                          : t("entityType.wiki")}
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
              {results.map((r: any) => (
                <tr key={r.id}>
                  <td>
                    <a href={`/entities/${r.id}`}>{r.type}</a>
                  </td>
                  <td>
                    <a href={`/entities/${r.id}`}>{r.name}</a>
                  </td>
                  <td>{new Date(r.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </Table>

          <div class="mt-4 flex justify-center space-x-2">
            {page > 0 && (
              <a
                href={`/entities/search?page=${page - 1}&entity_type=${encodeURIComponent(entityType)}&name=${encodeURIComponent(nameSearch)}`}
              >
                {t("action.previous")}
              </a>
            )}
            {results.length === 10 && page < totalCount.count / 10 && (
              <a
                href={`/entities/search?page=${page + 1}&entity_type=${encodeURIComponent(entityType)}&name=${encodeURIComponent(nameSearch)}`}
              >
                {t("action.next")}
              </a>
            )}
          </div>
        </div>
      </main>
    </Layout>,
  );
};
