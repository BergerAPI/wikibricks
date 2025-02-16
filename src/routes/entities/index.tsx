import { InfoBox, InfoBoxImage, InfoBoxRow } from "../../components/info-box";
import { sql, type BrandView, type DataEntityType, type EntityType, type EntityViewType, type SetView, type WikiView } from "../../database";
import { Layout } from "../../layout";
import { PermissionLevel, type DefaultContext } from "../../utils";

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

// Consolidate SQL query definitions per entity type to reduce duplications.
const queryMapping = {
    set: {
        defaultQuery: (entityId: string) => sql<(SetView & { brand_name: string })[]>`
            SELECT s.*, e.name as brand_name 
            FROM set_view s 
            LEFT JOIN entities e ON s.brand_id = e.id 
            WHERE s.id = ${entityId}`,
        versionQuery: (entityId: string, version: number) => sql<(SetView & { brand_name: string })[]>`
            SELECT s.*, e.name as brand_name 
            FROM set_versions_view s 
            LEFT JOIN entities e ON s.brand_id = e.id 
            WHERE s.id = ${entityId} AND s.version_id = ${version}`,
    },
    brand: {
        defaultQuery: (entityId: string) => sql<BrandView[]>`
            SELECT * FROM brand_view WHERE id = ${entityId}`,
        versionQuery: (entityId: string, version: number) => sql<BrandView[]>`
            SELECT * FROM brand_versions_view WHERE id = ${entityId} AND version_id = ${version}`,
    },
    wiki: {
        defaultQuery: (entityId: string) => sql<WikiView[]>`
            SELECT * FROM wiki_view WHERE id = ${entityId}`,
        versionQuery: (entityId: string, version: number) => sql<WikiView[]>`
            SELECT * FROM wiki_versions_view WHERE id = ${entityId} AND version_id = ${version}`,
    },
};

/**
 * Get an entity by ID and optionally version.
 * @param entityId The entity ID to fetch
 * @param version The version number to fetch
 * @returns The entity or null if not found
 */
const getEntity = async (entityId: string, version?: number) => {
    const [entityInfo] = await sql<{ type: string }[]>`
      SELECT type FROM entities WHERE id = ${entityId}
    `;

    if (!entityInfo) return null;

    const mapping = queryMapping[entityInfo.type as EntityType];
    if (!mapping) return null;

    return await sql.begin(async (sql) => {
        return version
            ? await mapping.versionQuery(entityId, version)
            : await mapping.defaultQuery(entityId);
    }).then((result) => result[0]);
};

const EntityInfoBox = <T extends EntityType>({ entity, fields, editable }: { entity: EntityViewType<T>, fields: EntityAttributes<T>, editable: boolean }) => {
    return <InfoBox title={entity.name}>
        <InfoBoxImage src="https://placehold.co/800x800" alt={`Image of ${entity.name}`} />

        {Object.entries(fields).map(([f, info]) => {
            const field = f as keyof EntityViewType<typeof entity.type>;

            if (!entity[field] && !editable) return null;

            return <InfoBoxRow label={typeof info === 'string' ? info : info.text}>
                {(() => {
                    const value = entity[field];

                    if (editable)
                        return (
                            <input
                                class="flex-1 border-none outline-none h-6"
                                field={field}
                                type={typeof value === 'number' ? "number" : "text"}
                                value={value instanceof Date ? value.toISOString() : value}
                            />
                        );

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

    const isProposedVersion = entity.review_status === "pending"
    const isModerator = (user?.permission_level ?? 0) > PermissionLevel.MODERATOR

    // Define info box fields based on entity type
    const infoFields = INFO_FIELDS[entity.type];

    return c.render(
        <Layout user={user}>
            <main class="overflow-auto">
                <div class="flex justify-between items-center pb-2 mb-3 border-b">
                    <h1 class="text-3xl font-serif">{!version ? entity.name : `${entity.name}: Version ${version}`}</h1>
                    <div class="space-x-2">
                        {!isProposedVersion && (edit ?
                            <a href={`/entities/${entity.id}`}>Cancel</a> :
                            <a href={`/entities/${entity.id}?edit`}>Edit Page</a>)}
                        <a href={`/entities/${entity.id}/history`}>Version History</a>
                    </div>
                </div>

                {edit && !isProposedVersion && <>
                    <div class="mb-3 pb-2 border-b flex items-center gap-2">
                        <label class="flex items-center flex-1 space-x-1">
                            <span>Change Message</span>
                            <input class="flex-1" id="change_message" />
                        </label>

                        <button id="save">Save</button>
                    </div>

                    <script dangerouslySetInnerHTML={{
                        __html: `
// When the user clicks the save button 
document.getElementById('save').addEventListener('click', async () => {
    const data = {}

    document.querySelectorAll("[field]").forEach(it => {
        const field = it.getAttribute('field');

        if (it.nodeName === 'INPUT')
            data[field] = it.value;
        else        
            data[field] = it.innerText;
    });

    const changeMessage = document.getElementById('change_message').value;
    data.changeMessage = changeMessage;

    fetch(\`/entities/${entity.id}\`, {
        method: 'POST',
        redirect: "follow",
        body: JSON.stringify(data),
        headers: {
            'Content-Type': 'application/json'
        }
    }).then(it => {
        window.location.href = "/entities/${entity.id}/history"
    });
});
`}} />
                </>}

                {isProposedVersion && isModerator && <>
                    <div class="mb-3 pb-2 border-b flex items-center gap-2">
                        <label class="flex items-center flex-1 space-x-1">
                            <span>Review Message</span>
                            <input class="flex-1" id="review_message" />
                        </label>

                        <button title="Approving a change will set the version HEAD to this version and set the version review status to 'approved'" id="approve">Approve</button>
                        <button title="Rejecting a change will discard the request to become the new HEAD version and every possibility to be merged into HEAD." id="reject">Reject</button>
                    </div>

                    <script dangerouslySetInnerHTML={{
                        __html: `
const reviewVersion = (type) => {
    fetch("/entities/${entity.id}/${entity.version_id}", {
        method: 'PATCH',
        redirect: "follow",
        body: JSON.stringify({
            type,
            reviewMessage: document.getElementById('review_message').value
        }),
        headers: {
            'Content-Type': 'application/json'
        }
    }).then(it => {
        window.location.href = "/entities/${entity.id}/history"
    });
};

// When the user approves a change
document.getElementById('approve').addEventListener('click', () => {
    reviewVersion("approved")
});

// When the user rejects a change
document.getElementById('reject').addEventListener('click', () => {
    reviewVersion("rejected")
});
                    `}} />
                </>}

                {Object.keys(infoFields).length > 0 && <EntityInfoBox editable={edit} entity={entity} fields={infoFields as EntityAttributes<typeof entity.type>} />}

                <div dangerouslySetInnerHTML={{
                    __html: entity.description.replaceAll("\n", "<br />")
                }} contenteditable={edit} field="description" class="text-pretty [&>ul]:mt-2" />
            </main>
        </Layout>,
    );
};

export const handleEntityPageSubmit = async (c: DefaultContext) => {
    const user = c.get("user");
    const entityId = c.req.param("id");

    if (!user)
        return c.body("Unauthorized", 401);

    const entity = await getEntity(entityId);

    if (!entity) return c.notFound();

    const { changeMessage, ...data } = await c.req.json();

    if (!changeMessage || Object.keys(data).length === 0) {
        return c.body("Bad Request", 400);
    }

    // Update the entity with the new data
    const modifiedFields = Object.entries(data).filter(([key, value]) => {
        const original = entity[key as keyof typeof entity];
        return value !== (original?.toString() ?? "");
    });

    if (modifiedFields.length === 0)
        return c.body("Bad Request", 400);

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
            }[entity.type as DataEntityType])} ${sql({
                version_id: newVersionId,
                ...Object.keys(data).filter(k => k !== 'description').filter(k => data[k] !== undefined && data[k].toString().length > 0).reduce((acc, key) => ({ ...acc, [key]: data[key] }), {}),
            })};
            `;
    });

    return c.body("OK", 200);
}

export const handleEntityVersionPatch = async (c: DefaultContext) => {
    const user = c.get("user");

    if (!user || user.permission_level < PermissionLevel.MODERATOR)
        return c.body("Unauthorized", 401);

    const entityId = c.req.param("id");
    const versionId = c.req.param("version");

    if (!entityId || !versionId)
        return c.body("Bad Request", 400)

    const entity = await getEntity(entityId, parseInt(versionId));

    if (!entity) return c.notFound();

    const { reviewMessage, type } = await c.req.json();

    if (!reviewMessage || !type || !["approved", "rejected"].includes(type))
        return c.body("Bad Request", 400)

    // Noting that the version has been review with the provided status
    await sql`
        UPDATE entity_versions SET review_status = ${type}, reviewed_at = NOW(), reviewed_by = ${user.id}, review_comment = ${reviewMessage} WHERE id = ${entity.version_id} AND entity_id = ${entity.id}
    `

    if (type === 'rejected')
        return c.body("OK", 200)

    // Setting the HEAD-id when approved
    await sql`
        UPDATE entities SET head_version_id = ${entity.version_id} WHERE id = ${entity.id}
    `

    return c.body("OK", 200)
};