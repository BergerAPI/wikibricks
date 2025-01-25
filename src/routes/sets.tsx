import { Layout } from '../layout'
import { sql } from '../database'
import { PermissionLevel, type DefaultContext } from '../utils'

type Set = {
    id: number
    name: string
    brand_name: string
    brand_id: number
    pieces: number
    manufacturer_id: string
    issued: string
}

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
        INSERT INTO t_set_change (set_id, user_id, old_value, new_value)
        VALUES (1, ${user.id}, NULL, ${JSON.stringify({ name, brand_id, pieces, description })})
    `;

    return c.redirect("/sets");
}

export const handleSetChangesPage = async (c: DefaultContext) => {
    const user = c.get("user");

    if (!user || user.permission_level < PermissionLevel.MODERATOR) {
        return c.redirect("/sets");
    }

    const changes = await sql`
        SELECT 
            sc.id,
            sc.old_value,
            sc.new_value,
            sc.created_at,
            sc.set_id,
            s.name as set_name,
            u.username as user_name,
            sc.status
        FROM t_set_change sc
        JOIN t_set s ON sc.set_id = s.id
        JOIN t_user u ON sc.user_id = u.id
        WHERE sc.status = 'pending'
        ORDER BY sc.created_at DESC
    `;

    return c.render(
        <Layout user={user}>
            <main>
                <h1 class="text-3xl font-serif pb-2 mb-3 border-b">Set Changes</h1>

                <div class="min-w-full overflow-x-auto">
                    <table class="table-auto w-full mt-4 border-collapse border">
                        <thead>
                            <tr class="[&>th]:border bg-background">
                                <th>Set</th>
                                <th>Changed By</th>
                                <th>Diff</th>
                                <th>Date</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {changes.map(change => {
                                const oldValue = change.old_value ? JSON.parse(change.old_value) : {};
                                const newValue = JSON.parse(change.new_value);

                                const diffItems = [];
                                if (!change.old_value) {
                                    diffItems.push(<div class="text-green-600">New set created</div>);
                                }

                                for (const [key, value] of Object.entries(newValue)) {
                                    if (change.old_value && oldValue[key] === value) continue;

                                    diffItems.push(
                                        <div key={key}>
                                            <strong>{key}:</strong>{' '}
                                            {change.old_value && (
                                                <span class="text-red-600">{oldValue[key]} → </span>
                                            )}
                                            <span class="text-green-600">{value}</span>
                                        </div>
                                    );
                                }

                                return (
                                    <tr class="[&>td]:border [&>td]:p-1" key={change.id}>
                                        <td>{change.set_name}</td>
                                        <td>{change.user_name}</td>
                                        <td>
                                            {diffItems}
                                        </td>
                                        <td>{new Date(change.created_at).toLocaleString()}</td>
                                        <td class="space-x-2">
                                            <form class="inline" method="post" action={`/sets/changes/${change.id}`}>
                                                <input type="hidden" name="type" value="accept" />
                                                <button class="px-2 py-1 bg-green-500 text-white rounded" type="submit">Accept</button>
                                            </form>
                                            <form class="inline" method="post" action={`/sets/changes/${change.id}`}>
                                                <input type="hidden" name="type" value="decline" />
                                                <button class="px-2 py-1 bg-red-500 text-white rounded" type="submit">Decline</button>
                                            </form>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </main>
        </Layout>
    );
}

export const handleChangeSubmit = async (c: DefaultContext) => {
    const user = c.get("user");
    if (!user || user.permission_level < PermissionLevel.MODERATOR) {
        return c.redirect("/sets");
    }

    const changeId = c.req.param("id");
    const { type } = await c.req.parseBody();
    const change = await sql`SELECT * FROM t_set_change WHERE id = ${changeId}`;

    if (!["accept", "decline"].includes(type.toString()) || !changeId || change.length === 0)
        return c.redirect("/sets/changes");

    if (type === "decline") {
        const changeId = c.req.param("id");
        await sql`UPDATE t_set_change SET status = 'declined' WHERE id = ${changeId}`;
        return c.redirect("/sets/changes");
    }

    const newValue = JSON.parse(change[0].new_value);

    if (change[0].old_value === null) {
        // Create new set
        await sql`
            INSERT INTO t_set (name, brand_id, pieces, description)
            VALUES (${newValue.name}, ${newValue.brand_id}, ${newValue.pieces}, ${newValue.description})
        `;
    } else {
        // Update existing set
        await sql`
            UPDATE t_set 
            SET name = ${newValue.name},
                brand_id = ${newValue.brand_id},
                pieces = ${newValue.pieces},
                description = ${newValue.description}
            WHERE id = ${change[0].set_id}
        `;
    }

    await sql`UPDATE t_set_change SET status = 'accepted' WHERE id = ${changeId}`;
    return c.redirect("/sets/changes");
}