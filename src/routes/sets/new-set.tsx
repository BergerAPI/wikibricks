import { sql } from "../../database";
import { Layout } from "../../layout";
import type { DefaultContext } from "../../utils";

export const handleNewSetPage = async (c: DefaultContext) => {
    const user = c.get("user");

    const brands = await sql<
        { brand_id: number; name: string }[]
    >`SELECT brand_id, name FROM brand_view ORDER BY name ASC;`;

    if (user === undefined) return c.redirect("/login?redirect=/sets/new");

    return c.render(
        <Layout user={user}>
            <main>
                <h1 class="text-3xl font-serif pb-2 mb-3 border-b">Add New Set</h1>

                <form
                    action="/sets/new"
                    method="post"
                    class="flex flex-col [&>label]:block [&>label>span]:text-gray-700 space-y-2"
                >
                    <label>
                        <span>Name</span>
                        <input
                            class="mt-1 block w-full"
                            name="name"
                            placeholder="Tuxedo Cat"
                        />
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
                            {brands.map((it) => (
                                <option value={it.brand_id}>{it.name}</option>
                            ))}
                        </select>
                    </label>

                    <button type="submit">Submit</button>
                </form>
            </main>
        </Layout>,
    );
};

export const handleNewSetSubmit = async (c: DefaultContext) => {
    const user = c.get("user");

    if (!user) return c.redirect("/login?redirect=/sets/new");

    const { name, brand_id, pieces, description } = await c.req.parseBody();

    if (!name || !brand_id || !pieces || !description) {
        return c.redirect("/sets/new");
    }

    // Every created set by a user will be handles by a change and needs to be accepted by a moderator
    await sql`
        WITH new_entity AS (
            INSERT INTO entities (name, type)
            VALUES (${name.toString()}, 'set')
            RETURNING id
        ), new_version AS (
            INSERT INTO entity_versions (
                entity_id,
                version_number,
                created_by,
                description
            )
            SELECT
                id,
                1,
                ${user.id.toString()},
                ${description.toString()}
            FROM new_entity
            RETURNING id
        )
        INSERT INTO sets (
            version_id,
            pieces,
            brand_id
        )
        SELECT
            id,
            ${pieces.toString()},
            ${brand_id.toString()}
        FROM new_version;
    `;

    return c.redirect("/sets");
};
