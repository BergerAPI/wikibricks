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

const EntityInfoBox = <T extends EntityType>({ entity, fields, editable }: { entity: EntityViewType<T>, fields: EntityAttributes<T>, editable: boolean }) => {
    return <InfoBox title={entity.name}>
        <InfoBoxImage src="https://placehold.co/800x800" alt={`Image of ${entity.name}`} />

        {Object.entries(fields).map(([f, info]) => {
            const field = f as keyof EntityViewType<typeof entity.type>;

            if (!entity[field]) return null;

            return <InfoBoxRow label={typeof info === 'string' ? info : info.text}>
                {typeof info === 'string' ? <span field={field} contenteditable={editable}>{entity[field]}</span> : info.link !== undefined ? (
                    <a contenteditable={editable} field={field} href={info.link(entity[field])}>{info.value(entity[field], entity)}</a>
                ) : <span contenteditable={editable} field={field}>{info.value(entity[field])}</span>}
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
                        WHERE s.id = ${entityId} AND s.version_number = ${version}
                    `;

                return await sql<(SetView & { brand_name: string })[]>`
                    SELECT s.*, e.name as brand_name FROM set_view s
                    LEFT JOIN entities e ON s.brand_id = e.id
                    WHERE s.id = ${entityId}
                `;
            case 'brand':
                if (version)
                    return await sql<BrandView[]>`
                        SELECT * FROM brand_versions_view WHERE id = ${entityId} AND version_number = ${version}
                    `;

                return await sql<BrandView[]>`
                    SELECT * FROM brand_view WHERE id = ${entityId}
                `;
            case 'wiki':
                if (version)
                    return await sql<WikiView[]>`
                        SELECT * FROM wiki_versions_view WHERE id = ${entityId} AND version_number = ${version}
                    `;

                return await sql<WikiView[]>`
                    SELECT * FROM wiki_view WHERE id = ${entityId}
                `;
            default:
                return [null];
        }
    });

    if (!entity) return c.notFound();

    // Define info box fields based on entity type
    const infoFields = INFO_FIELDS[entity.type];

    return c.render(
        <Layout user={user}>
            <main class="overflow-auto">
                <div class="flex justify-between items-center pb-2 mb-3 border-b">
                    <h1 class="text-3xl font-serif">{!version ? entity.name : `${entity.name}: Version ${version}`}</h1>
                    <div class="space-x-2">
                        <a href={`/entities/${entity.id}/history`}>Version History</a>
                    </div>
                </div>

                {Object.keys(infoFields).length > 0 && <EntityInfoBox editable={true} entity={entity} fields={infoFields as EntityAttributes<typeof entity.type>} />}

                <div contenteditable={edit} field="description" class="text-pretty [&>ul]:mt-2">{entity.description}</div>

                {edit && <button id="save" class="mt-2">Save</button>}
            </main>

            <script dangerouslySetInnerHTML={{
                __html: `
// When the user clicks the save button 
document.getElementById('save').addEventListener('click', async () => {
    const data = {}

    document.querySelectorAll("[contenteditable]").forEach(it => {
        data[it.getAttribute('field')] = it.innerText;
    });

    await fetch(\`/entities/${entity.id}\`, {
        method: 'POST',
        body: JSON.stringify(data),
        headers: {
            'Content-Type': 'application/json'
        }
    });
});
`}} />
        </Layout>,
    );
};