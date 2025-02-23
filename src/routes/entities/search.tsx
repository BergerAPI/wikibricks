import { Layout } from "../../layout";
import { sql } from "../../database";
import { PermissionLevel, type DefaultContext } from "../../utils";

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
        ? sql`WHERE ${filters.reduce((acc, cur, idx) =>
            idx === 0 ? cur : sql`${acc} AND ${cur}`, sql``
        )
            }`
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
                    <h1 class="text-3xl font-serif">Entities</h1>
                    <div class="space-x-2">
                        <a href="/entities/new">Add Entity</a>
                    </div>
                </div>

                <form method="get" action="/entities/search" class="mb-4">
                    <div class="flex flex-wrap space-x-4 items-end">
                        <div>
                            <label class="block font-semibold">Entity Type</label>
                            <select name="entity_type" class="border p-2 rounded">
                                {["all", "set", "brand", "wiki"].map((option) => (
                                    <option value={option} selected={entityType === option}>
                                        {option.charAt(0).toUpperCase() + option.slice(1)}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label class="block font-semibold">Name</label>
                            <input
                                type="text"
                                name="name"
                                value={nameSearch}
                                class="border p-2 rounded"
                                placeholder="Search by name"
                            />
                        </div>
                        <div>
                            <button type="submit" class="border p-2 rounded">Search</button>
                        </div>
                    </div>
                </form>

                <div class="min-w-full overflow-x-auto">
                    <table class="w-full border-collapse">
                        <thead class="bg-gray-200">
                            <tr>
                                <th class="p-2 text-left">Type</th>
                                <th class="p-2 text-left">Name</th>
                                <th class="p-2 text-left">Description</th>
                                <th class="p-2 text-left">Created At</th>
                            </tr>
                        </thead>
                        <tbody>
                            {results.map((r: any) => (
                                <tr key={r.id} class="border-b">
                                    <td class="p-2">
                                        <a href={`/entities/${r.id}`}>{r.type}</a>
                                    </td>
                                    <td class="p-2">
                                        <a href={`/entities/${r.id}`}>{r.name}</a>
                                    </td>
                                    <td class="p-2">{r.description}</td>
                                    <td class="p-2">{new Date(r.created_at).toLocaleDateString()}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    <div class="mt-4 flex justify-center space-x-2">
                        {page > 0 && (
                            <a
                                href={`/entities/search?page=${page - 1}&entity_type=${encodeURIComponent(entityType)}&name=${encodeURIComponent(nameSearch)}`}
                            >
                                Previous
                            </a>
                        )}
                        {results.length === 10 && page < totalCount.count / 10 && (
                            <a
                                href={`/entities/search?page=${page + 1}&entity_type=${encodeURIComponent(entityType)}&name=${encodeURIComponent(nameSearch)}`}
                            >
                                Next
                            </a>
                        )}
                    </div>
                </div>
            </main>
        </Layout>
    );
};