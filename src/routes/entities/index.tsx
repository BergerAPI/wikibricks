import { InfoBox, InfoBoxImage, InfoBoxRow } from "../../components/info-box";
import { sql, type BrandView, type EntityType, type EntityViewType, type SetView, type WikiView } from "../../database";
import { Layout } from "../../layout";
import type { DefaultContext } from "../../utils";

type AttributeDefinition<T, K extends keyof T> = string | {
    text: string;
    link?: (value: T[K]) => string;
    value: (value: T[K], obj: T) => string;
}

type EntityAttributes<T extends EntityType, J = {}> = Partial<{
    [P in keyof (EntityViewType<T> & J)]: AttributeDefinition<EntityViewType<T> & J, P>
}>


type InfoFields<J = {
    "set": {
        "brand_name"?: string;
    },
}> = {
        [K in EntityType]: EntityAttributes<K, J extends { [key in K]?: any } ? J[K] : {}>
    }

const INFO_FIELDS: InfoFields = {
    'set': {
        'pieces': 'Pieces',
        'size': 'Size',
        'theme': 'Theme',
        'issued': 'Issued',
        'brand_id': {
            text: 'Brand',
            link: (value) => `/entities/${value}`,
            value: (value, obj) => obj.brand_name || value,
        },
    },
    'brand': {
        'country': 'Country',
        'website': {
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
    'wiki': {},
};

const EntityInfoBox = <T extends EntityType>({ entity, fields }: { entity: EntityViewType<T>, fields: EntityAttributes<T> }) => {
    return <InfoBox title={entity.name}>
        <InfoBoxImage src="https://placehold.co/800x800" alt={`Image of ${entity.name}`} />

        {Object.entries(fields).map(([f, info]) => {
            const field = f as keyof EntityViewType<typeof entity.type>;

            if (!entity[field]) return null;

            return <InfoBoxRow label={typeof info === 'string' ? info : info.text}>
                {typeof info === 'string' ? entity[field] : info.link !== undefined ? (
                    <a href={info.link(entity[field])}>{info.value(entity[field], entity)}</a>
                ) : info.value(entity[field])}
            </InfoBoxRow>
        })}
    </InfoBox>
}

export const handleEntityPage = async (c: DefaultContext) => {
    const user = c.get("user");
    const entityId = c.req.param("id");

    const [entity] = await sql.begin(async (sql) => {
        // First get the entity type
        const [entityInfo] = await sql<{ type: string }[]>`
            SELECT type FROM entities WHERE id = ${entityId}
        `;

        if (!entityInfo) return [null];

        // Then fetch from the appropriate view based on type
        switch (entityInfo.type) {
            case 'set':
                return await sql<(SetView & { brand_name: string })[]>`
                    SELECT s.*, e.name as brand_name FROM set_view s
                    LEFT JOIN entities e ON s.brand_id = e.id
                    WHERE s.id = ${entityId}
                `;
            case 'brand':
                return await sql<BrandView[]>`
                    SELECT * FROM brand_view WHERE id = ${entityId}
                `;
            case 'wiki':
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
                    <h1 class="text-3xl font-serif">{entity.name}</h1>
                    <div class="space-x-2">
                        <a href={`/entities/${entity.id}/history`}>Version History</a>
                    </div>
                </div>

                {Object.keys(infoFields).length > 0 && <EntityInfoBox entity={entity} fields={infoFields as EntityAttributes<typeof entity.type>} />}

                <div class="text-pretty [&>ul]:mt-2">{entity.description}</div>
            </main>
        </Layout>,
    );
};