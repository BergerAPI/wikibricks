import { Layout } from "../../layout";
import { sql, type SetView } from "../../database";
import { PermissionLevel, type DefaultContext } from "../../utils";

export const handleSetsPage = async (c: DefaultContext) => {
    const user = c.get("user");

    // Simple pagination
    let page: any | number = c.req.query("page");

    if (page && isNaN(Number(page))) return c.redirect("/sets");
    else page = Number(page) || 0;

    const [sets, [totalCount]] = await Promise.all([
        sql<(SetView & { brand_name: number })[]>`
            SELECT s.id, s.name, b.name as brand_name, s.manufacturer_id, s.issued, s.brand_id, s.pieces
            FROM set_view s
            LEFT JOIN brand_view b ON s.brand_id = b.brand_id
            ORDER BY s.issued DESC, s.name ASC
            LIMIT 10 OFFSET ${page ? page * 10 : 0}
        `,
        sql<[{ count: number }]>`
            SELECT COUNT(*) as count FROM set_view
        `,
    ]);

    return c.render(
        <Layout user={user}>
            <main class="min-w-0">
                <div class="flex justify-between pb-2 mb-3 border-b">
                    <h1 class="text-3xl font-serif">Sets</h1>
                    <div class="space-x-2">
                        <a href="/sets/new">Add Set</a>
                        {user && user.permission_level >= PermissionLevel.MODERATOR && (
                            <a href="/changes?type=set">Set Changes</a>
                        )}
                    </div>
                </div>

                <p class="text-pretty">
                    Bricks have captivated builders and enthusiasts for generations,
                    serving as the foundation for creativity and engineering. Renowned
                    companies like LEGO, known for their iconic interlocking plastic
                    bricks, and BlueBrixx, which specializes in detailed and innovative
                    designs, have brought endless possibilities to fans around the world.
                    From classic sets to modern architectural marvels, the diverse
                    offerings from various brands continue to inspire imagination and
                    craftsmanship. Explore the rich variety of brick collections that have
                    shaped the way we play, create, and construct.
                </p>

                <div class="min-w-full overflow-x-auto">
                    <table class="table-auto w-full mt-4 border-collapse border overflow-x-scroll [&_td]:border [&_th]:border">
                        <thead>
                            <tr class="bg-background">
                                <th>Brand</th>
                                <th>Name</th>
                                <th>Pieces</th>
                            </tr>
                        </thead>

                        <tbody>
                            {sets.map((set) => (
                                <tr class="[&>td]:p-1" key={set.id}>
                                    <td>
                                        <a href={`/entities/${set.brand_id}`}>{set.brand_name}</a>
                                    </td>
                                    <td>
                                        <a href={`/entities/${set.id}`}>{set.name}</a>
                                    </td>
                                    <td>{set.pieces}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    <div class="mt-4 flex justify-center space-x-2">
                        {page > 0 && <a href={`/sets?page=${page - 1}`}>Previous</a>}
                        {sets.length === 10 && page < totalCount.count / 10 && (
                            <a href={`/sets?page=${page + 1}`}>Next</a>
                        )}
                    </div>
                </div>
            </main>
        </Layout>,
    );
};