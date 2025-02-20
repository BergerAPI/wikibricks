import { INFO_FIELDS, type EntityAttributes } from ".";
import { sql, type EntityType } from "../../database";
import { Layout } from "../../layout";
import type { DefaultContext } from "../../utils";

export const handleNewEntityPage = async (c: DefaultContext) => {
    const user = c.get("user");

    if (user === undefined) return c.redirect("/login?redirect=/entities/new");

    return c.render(
        <Layout user={user}>
            <main>
                <h1 class="text-3xl font-serif pb-2 mb-3 border-b">Add New Entity</h1>

                <div>
                    <label class="block mb-3">
                        <span class="font-semibold">Entity Type</span>
                        <select class="mt-1 block w-full" field="entity_type" name="brand_id" value="set" id="entity_type">
                            {Object.keys(INFO_FIELDS).map(id => <option value={id}>
                                {id.at(0)?.toUpperCase() + id.slice(1, id.length).toLowerCase()}
                            </option>)}
                        </select>
                    </label>

                    <label class="block mb-3">
                        <span class="font-semibold">Name</span>
                        <input id="name" field="name" value="" class="border p-2 rounded w-full" />
                    </label>

                    <label class="block mb-3">
                        <span class="font-semibold">Description</span>
                        <textarea field="description" id="description" value="" class="border p-2 rounded w-full" />
                    </label>

                    {/* Tab contents */}
                    {Object.keys(INFO_FIELDS).map((id, index) => (
                        <div key={id} id={`tab-${id}`} class={`tab-content ${index === 0 ? "" : "hidden"}`}>
                            {Object.entries(INFO_FIELDS[id as keyof typeof INFO_FIELDS]).map(([key, def]) => {
                                let fieldLabel = "";
                                let inputType: "text" | "number" = "text";

                                if (typeof def === "string") {
                                    fieldLabel = def;
                                } else {
                                    fieldLabel = def.text;
                                    inputType = def.type === "number" ? "number" : "text";
                                }

                                return (
                                    <label htmlFor={key} class="block mb-3">
                                        <span class="font-semibold">{fieldLabel}</span>

                                        <input
                                            id={key}
                                            field={key}
                                            type={inputType}
                                            value={""}
                                            class="border p-2 rounded w-full"
                                        />
                                    </label>
                                );
                            })}
                        </div>
                    ))}

                    <button id="submit_button">Submit</button>
                </div>

                <script dangerouslySetInnerHTML={{
                    __html: `
document.getElementById("submit_button").addEventListener("click", () => {
    const data = {};
    // Only include fields that are visible (i.e. not in a hidden tab)
    document.querySelectorAll("[field]").forEach(it => {
        // Check if the element is visible by verifying its offsetParent is not null
        if (it.offsetParent !== null) {
            const field = it.getAttribute('field');
            data[field] = it.value;
        }
    });

    fetch(\`/entities/new\`, {
        method: 'POST',
        redirect: "follow",
        body: JSON.stringify(data),
        headers: {
            'Content-Type': 'application/json'
        }
    }).then(it => {
        
    });
})

document.getElementById("entity_type").addEventListener("change", () => {
    const selected = document.getElementById("entity_type").value
    document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
    const content = document.getElementById("tab-" + selected);
    if(content) content.classList.remove('hidden');
})
                    `
                }} />
            </main>
        </Layout>,
    );
};

export const handleNewEntitySubmit = async (c: DefaultContext) => {
    const user = c.get("user");

    if (!user) return c.body("Unauthorized", 401);;

    const { name, description, entity_type, ...data } = await c.req.json();

    if (!name || !description || !entity_type) {
        return c.body("Bad Request", 400);
    }

    // Checking whether the necessary fields of the specific entity type have been supplied
    const typeInfo = INFO_FIELDS[entity_type as keyof typeof INFO_FIELDS];

    if (!typeInfo) return c.body("Bad Request", 400);

    for (const [fieldKey] of Object.entries(typeInfo)) {
        if (data[fieldKey] !== undefined)
            continue

        return c.body("Bad Request", 400)
    }

    // Every created set by a user will be handles by a change and needs to be accepted by a moderator
    const d = await sql.begin(async sql => {
        const [{ id }] = await sql<{ id: number }[]>`
            WITH new_entity AS (
                INSERT INTO entities (name, type)
                VALUES (${name.toString()}, ${entity_type})
                RETURNING id
            ), new_version AS (
                INSERT INTO entity_versions (
                    entity_id,
                    version_number,
                    created_by,
                    review_status,
                    description
                )
                SELECT
                    id,
                    1,
                    ${user.id.toString()},
                    'pending',
                    ${description.toString()}
                FROM new_entity
                RETURNING id
            ) SELECT id FROM new_version;
        `;

        // Handling creation of the specific entity tables
        if (entity_type === "set") {
            await sql`
                INSERT INTO sets ${sql({
                version_id: id,
                ...data
            })}`;
        } else if (entity_type === "brand") {
            await sql`
                INSERT INTO brands ${sql({
                version_id: id,
                ...data
            })}`;
        } else if (entity_type === "wiki") {
            // No additional table insertion is needed for wiki entities.
        }
    })


    return c.body("Ok", 200);
};