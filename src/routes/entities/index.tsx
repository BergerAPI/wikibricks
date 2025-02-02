import { sql, type BrandView, type EntityType, type EntityViewType, type SetView } from "../../database";
import { Layout } from "../../layout";
import type { DefaultContext } from "../../utils";

type AttributeDefinition<T, K extends keyof T> = string | {
    text: string;
    link: (value: T[K]) => string;
} | {
    text: string;
    value: (value: T[K]) => string;
}

type EntityAttributes<T extends EntityType> = Partial<{
    [P in keyof EntityViewType<T>]: AttributeDefinition<EntityViewType<T>, P>
}>


type InfoFields = {
    [K in EntityType]: EntityAttributes<K>
}

const INFO_FIELDS: InfoFields = {
    'set': {
        'pieces': 'Pieces',
        'size': 'Size',
        'theme': 'Theme',
        'issued': 'Issued',
        'brand_id': {
            text: 'Brand',
            link: (value: string) => `/entities/${value}`
        },
    },
    'brand': {
        'country': 'Country',
        'website': {
            text: 'Website',
            link: (value: string) => value
        },
    },
    'wiki': {},
};

const InfoBox = <T extends EntityType>({ entity, fields }: { entity: EntityViewType<T>, fields: EntityAttributes<T> }) => {
    return <div class="sm:float-right sm:clear-both sm:ml-2 sm:w-64 w-full bg-background border mb-2 p-1">
        <table class="m-auto border-spacing-0.5 leading-6">
            <tbody>
                <tr>
                    <th colspan={2} class="infobox-above">
                        {entity.name}
                    </th>
                </tr>
                <tr>
                    <td colspan={2}>
                        <img
                            class="px-1"
                            src="https://placehold.co/800x800"
                            width="800"
                            height="800"
                            loading="lazy"
                            decoding="async"
                            alt={`Image of ${entity.name}`}
                        />
                    </td>
                </tr>

                {Object.entries(fields).map(([f, info]) => {
                    const field = f as keyof EntityViewType<typeof entity.type>;

                    if (!entity[field]) return null;

                    return <tr>
                        <th scope="row" class="text-left">
                            {typeof info === 'string' ? info : info.text}
                        </th>
                        <td class="text-left">
                            {typeof info === 'string' ? entity[field] : info.link !== undefined ? (
                                <a href={info.link(entity[field])}>{entity[field]}</a>
                            ) : info.value(entity[field])}
                        </td>
                    </tr>
                })}
            </tbody>
        </table>
    </div>
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
                return await sql<SetView[]>`
                    SELECT * FROM set_view WHERE id = ${entityId}
                `;
            case 'brand':
                return await sql<BrandView[]>`
                    SELECT * FROM brand_view WHERE brand_id = ${entityId}
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
                <h1 class="text-3xl font-serif pb-2 mb-3 border-b">{entity.name}</h1>

                {Object.keys(infoFields).length > 0 && <InfoBox entity={entity} fields={infoFields as EntityAttributes<typeof entity.type>} />}

                <div class="text-pretty [&>ul]:mt-2">{entity.description}</div>
            </main>
        </Layout>,
    );
};