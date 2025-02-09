import { InfoBox, InfoBoxImage, InfoBoxRow } from "../../components/info-box";
import { sql, type BrandView, type EntityType, type EntityViewType, type SetView, type WikiView } from "../../database";
import { Layout } from "../../layout";
import type { DefaultContext } from "../../utils";

/**
 * Defines an attribute for a given property.
 * Can either be a string label or an object that defines text, link and value formatter.
 */
type AttributeDefinition<T, K extends keyof T> =
    | string
    | {
        text: string;
        link?: (value: T[K]) => string;
        value: (value: T[K], obj: T) => string;
    };

/**
 * Defines a mapping of entity attribute keys to attribute definitions.
 */
type EntityAttributes<
    E extends EntityType,
    Extra = {}
> = Partial<{
    [P in keyof (EntityViewType<E> & Extra)]: AttributeDefinition<EntityViewType<E> & Extra, P>;
}>;

/**
 * Defines the info field configuration for all entity types.
 */
type InfoFields<Extra extends { [key in EntityType]?: any } = { set: { brand_name?: string } }> = {
    [K in EntityType]: EntityAttributes<K, K extends keyof Extra ? Extra[K] : {}>;
};

/**
 * Defines the info fields for each entity type.
 */
export const INFO_FIELDS: InfoFields = {
    set: {
        pieces: 'Pieces',
        size: 'Size',
        theme: 'Theme',
        issued: 'Issued',
        brand_id: {
            text: 'Brand',
            link: (value) => `/entities/${value}`,
            value: (value, obj) => obj.brand_name || value,
        },
    },
    brand: {
        country: 'Country',
        website: {
            text: 'Website',
            link: (value) => {
                const full = value.startsWith('http') ? value : `https://${value}`

                try {
                    new URL(full);
                    return full;
                } catch {
                    return '#';
                }
            },
            value: (value, _) => value,
        },
    },
    wiki: {},
};

/**
 * Get an entity by ID and optionally version.
 * @param entityId The entity ID to fetch
 * @param version The version number to fetch
 * @returns The entity or null if not found
 */
const getEntity = async (entityId: string, version?: number) => {
    const [entity] = await sql.begin(async (sql) => {
        // First get the entity type
        const [entityInfo] = await sql<{ type: string }[]>`
            SELECT type FROM entities WHERE id = ${entityId}
        `;

        if (!entityInfo) return [null];

        // Then fetch from the appropriate view based on type
        switch (entityInfo.type) {
            case 'set':
                if (version)
                    return await sql<(SetView & { brand_name: string })[]>`
                        SELECT s.*, e.name as brand_name
                        FROM set_versions_view s
                        LEFT JOIN entities e ON s.brand_id = e.id
                        WHERE s.id = ${entityId} AND s.version_id = ${version}
                    `;

                return await sql<(SetView & { brand_name: string })[]>`
                    SELECT s.*, e.name as brand_name FROM set_view s
                    LEFT JOIN entities e ON s.brand_id = e.id
                    WHERE s.id = ${entityId}
                `;
            case 'brand':
                if (version)
                    return await sql<BrandView[]>`
                        SELECT * FROM brand_versions_view WHERE id = ${entityId} AND version_id = ${version}
                    `;

                return await sql<BrandView[]>`
                    SELECT * FROM brand_view WHERE id = ${entityId}
                `;
            case 'wiki':
                if (version)
                    return await sql<WikiView[]>`
                        SELECT * FROM wiki_versions_view WHERE id = ${entityId} AND version_id = ${version}
                    `;

                return await sql<WikiView[]>`
                    SELECT * FROM wiki_view WHERE id = ${entityId}
                `;
            default:
                return [null];
        }
    });

    return entity;
}

const EntityInfoBox = <T extends EntityType>({ entity, fields, editable }: { entity: EntityViewType<T>, fields: EntityAttributes<T>, editable: boolean }) => {
    return <InfoBox title={entity.name}>
        <InfoBoxImage src="https://placehold.co/800x800" alt={`Image of ${entity.name}`} />

        {Object.entries(fields).map(([f, info]) => {
            const field = f as keyof EntityViewType<typeof entity.type>;

            if (!entity[field]) return null;

            return <InfoBoxRow label={typeof info === 'string' ? info : info.text}>
                {(() => {
                    const value = entity[field];

                    if (editable)
                        return <span field={field} contentEditable>{value}</span>;

                    if (typeof info === 'string')
                        return <span>{value}</span>;

                    if (info.link)
                        return (
                            <a href={info.link(value)}>
                                {info.value(value, entity)}
                            </a>
                        );

                    return (
                        <span>
                            {info.value(value, entity)}
                        </span>
                    );
                })()}
            </InfoBoxRow>
        })}
    </InfoBox>
}

export const handleEntityPage = async (c: DefaultContext) => {
    const user = c.get("user");
    const entityId = c.req.param("id");

    // Possible query parameters for versioned entities and edit mode
    const version = c.req.query("version");
    const edit = c.req.query("edit") !== undefined;

    const entity = await getEntity(entityId, version ? parseInt(version) : undefined);

    if (!entity) return c.notFound();

    // Define info box fields based on entity type
    const infoFields = INFO_FIELDS[entity.type];

    return c.render(
        <Layout user={user}>
            <main class="overflow-auto">
                <div class="flex justify-between items-center pb-2 mb-3 border-b">
                    <h1 class="text-3xl font-serif">{!version ? entity.name : `${entity.name}: Version ${version}`}</h1>
                    <div class="space-x-2">
                        {edit ?
                            <a href={`/entities/${entity.id}`}>Cancel</a> :
                            <a href={`/entities/${entity.id}?edit`}>Edit Page</a>}
                        <a href={`/entities/${entity.id}/history`}>Version History</a>
                    </div>
                </div>

                {edit && <div class="mb-3 pb-2 border-b flex items-center gap-2">
                    <label class="flex items-center flex-1 space-x-1">
                        <span>Change Message</span>
                        <input class="flex-1" id="change_message" />
                    </label>

                    <button id="save">Save</button>
                </div>}

                {Object.keys(infoFields).length > 0 && <EntityInfoBox editable={edit} entity={entity} fields={infoFields as EntityAttributes<typeof entity.type>} />}

                <div contenteditable={edit} field="description" class="text-pretty [&>ul]:mt-2">{entity.description}</div>
            </main>

            {edit && <script dangerouslySetInnerHTML={{
                __html: `
// When the user clicks the save button 
document.getElementById('save').addEventListener('click', async () => {
    const data = {}

    document.querySelectorAll("[contenteditable]").forEach(it => {
        data[it.getAttribute('field')] = it.innerText;
    });

    const changeMessage = document.getElementById('change_message').value;
    data.changeMessage = changeMessage;

    await fetch(\`/entities/${entity.id}\`, {
        method: 'POST',
        body: JSON.stringify(data),
        headers: {
            'Content-Type': 'application/json'
        }
    });
});
`}} />}
        </Layout>,
    );
};

export const handleEntityPageSubmit = async (c: DefaultContext) => {
    const user = c.get("user");
    const entityId = c.req.param("id");

    if (!user) return c.redirect("/login?redirect=/entities/${entityId}");

    const entity = await getEntity(entityId);

    if (!entity) return c.notFound();

    const { changeMessage, ...data } = await c.req.json();

    if (!changeMessage || Object.keys(data).length === 0) {
        return c.redirect(`/entities/${entityId}?edit`);
    }

    // Update the entity with the new data
    const modifiedFields = Object.entries(data).filter(([key, value]) => value !== (entity[key as keyof typeof entity]?.toString() ?? ''))

    if (modifiedFields.length === 0)
        return c.redirect(`/entities/${entityId}`);

    await sql.begin(async (sql) => {
        const [{ id: newVersionId }] = await sql<{ id: number }[]>`
        INSERT INTO entity_versions ${sql({
            entity_id: entityId,
            version_number: entity.version_number + 1,
            created_by: user.id,
            change_message: changeMessage,
            description: data.description,
            review_status: 'pending',
        })}
            RETURNING id;
        `;

        if (['set', 'brand'].includes(entity.type))
            await sql`
            INSERT INTO ${sql({
                set: 'sets',
                brand: 'brands',
            }[entity.type as 'set' | 'brand'])} ${sql({
                version_id: newVersionId,
                ...Object.keys(data).filter(k => k !== 'description').reduce((acc, key) => ({ ...acc, [key]: data[key] }), {}),
            })};
            `;
    });

    return c.redirect(`/entities/${entityId}/history`);
}