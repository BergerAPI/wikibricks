import { Layout } from '../../layout'
import { sql, type Set } from '../../database'
import { PermissionLevel, type DefaultContext } from '../../utils'

export const handleSetsPage = async (c: DefaultContext) => {
    const user = c.get("user");
    const sets = await sql<Set[]>`
        SELECT s.id, s.name, b.name as brand_name, s.manufacturer_id, s.issued, s.brand_id, s.pieces
        FROM t_set s
        LEFT JOIN t_brand b ON s.brand_id = b.id 
        ORDER BY s.issued DESC, s.name ASC;
    `;

    return c.render(
        <Layout user={user}>
            <main class="min-w-0">
                <div class="flex justify-between pb-2 mb-3 border-b">
                    <h1 class="text-3xl font-serif">Sets</h1>
                    <div>
                        <a href="/sets/new">Add set</a>
                        {user && user.permission_level >= PermissionLevel.MODERATOR && <a href="/sets/changes">Set Changes</a>}
                    </div>
                </div>

                <p class="text-pretty">
                    Bricks have captivated builders and enthusiasts for generations, serving as the foundation for
                    creativity and engineering. Renowned companies like LEGO, known for their iconic interlocking plastic
                    bricks, and BlueBrixx, which specializes in detailed and innovative designs, have brought endless
                    possibilities to fans around the world. From classic sets to modern architectural marvels, the diverse
                    offerings from various brands continue to inspire imagination and craftsmanship. Explore the rich
                    variety of brick collections that have shaped the way we play, create, and construct.
                </p>

                <div class="min-w-full overflow-x-auto">
                    <table class="table-auto w-full mt-4 border-collapse border overflow-x-scroll">
                        <thead>
                            <tr class="[&>th]:border bg-background">
                                <th>Brand</th>
                                <th>Name</th>
                                <th>Pieces</th>
                            </tr>
                        </thead>

                        <tbody>
                            {sets.map(set => (
                                <tr class="[&>td]:border [&>td]:p-1" key={set.id}>
                                    <td>
                                        <a href={`/brands/${set.brand_id}`}>{set.brand_name}</a>
                                    </td>
                                    <td>
                                        <a href={`/sets/${set.id}`}>{set.name}</a>
                                    </td>
                                    <td>
                                        {set.pieces}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </main>
        </Layout>
    )
}

export const handleNewSetPage = async (c: DefaultContext) => {
    const user = c.get("user");

    const brands = await sql<{ id: number, name: string }[]>`SELECT id, name FROM t_brand ORDER BY name ASC;`;

    if (user === undefined) return c.redirect("/login?redirect=/sets/new");

    return c.render(
        <Layout user={user}>
            <main>
                <h1 class="text-3xl font-serif pb-2 mb-3 border-b">Add New Set</h1>

                <form action="/sets/new" method="post" class="flex flex-col [&>label]:block [&>label>span]:text-gray-700 space-y-2">
                    <label>
                        <span>Name</span>
                        <input class="mt-1 block w-full" name="name" placeholder="Tuxedo Cat" />
                    </label>

                    <label>
                        <span>Description</span>
                        <textarea class="mt-1 block w-full" name="description"></textarea>
                    </label>

                    <label>
                        <span>Piece Count</span>
                        <input class="mt-1 block w-full" name="pieces" type="number" />
                    </label>

                    <label>
                        <span>Brand</span>
                        <select class="mt-1 block w-full" name="brand_id" type="number">
                            {brands.map(it => <option value={it.id}>{it.name}</option>)}
                        </select>
                    </label>

                    <button type="submit">Submit</button>
                </form>
            </main>
        </Layout>
    )
}

export const handleNewSetSubmit = async (c: DefaultContext) => {
    const user = c.get("user");

    if (!user) return c.redirect("/login?redirect=/sets/new");

    const { name, brand_id, pieces, description } = await c.req.parseBody();

    if (!name || !brand_id || !pieces || !description) {
        return c.redirect("/sets/new");
    }

    // Every created set by a user will be handles by a change and needs to be accepted by a moderator
    await sql`
        INSERT INTO t_set_change (set_id, user_id, old_value, new_value, status)
        VALUES (1, ${user.id}, NULL, ${JSON.stringify({ name, brand_id, pieces, description })}, 'pending')
    `;

    return c.redirect("/sets");
}