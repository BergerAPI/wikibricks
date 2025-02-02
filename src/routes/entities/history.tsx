import { sql, type EntityVersion } from "../../database";
import { Layout } from "../../layout";
import type { DefaultContext } from "../../utils";

type VersionWithUsername = EntityVersion & {
    username: string;
};

export const handleEntityHistoryPage = async (c: DefaultContext) => {
    const user = c.get("user");
    const entityId = c.req.param("id");

    // Fetch entity versions with usernames
    const [[entityInfo], versions] = await Promise.all([
        sql<{ name: string }[]>`
            SELECT name FROM entities WHERE id = ${entityId}
        `,
        sql<VersionWithUsername[]>`
            SELECT 
                ev.*,
                u.username
            FROM entity_versions ev
            LEFT JOIN users u ON ev.created_by = u.id
            WHERE ev.entity_id = ${entityId}
            ORDER BY ev.version_number DESC
        `
    ]);

    if (versions.length === 0 || !entityInfo) return c.notFound();


    return c.render(
        <Layout user={user}>
            <main>
                <h1 class="text-3xl font-serif pb-2 mb-3 border-b">Version History: {entityInfo.name}</h1>

                <p class="text-pretty pb-2">
                    Version history for {entityInfo.name}. Click on a version to view details. Listed in descending order.
                </p>

                <div>
                    <table class="w-full">
                        <thead>
                            <tr class="border-b">
                                <th class="text-left p-2">Version</th>
                                <th class="text-left p-2">Created</th>
                                <th class="text-left p-2">Author</th>
                                <th class="text-left p-2">Status</th>
                                <th class="text-left p-2">Change Message</th>
                            </tr>
                        </thead>
                        <tbody>
                            {versions.map((version) => (
                                <tr key={version.id} class="border-b hover:bg-background">
                                    <td class="p-2">
                                        <a
                                            href={`/entities/${entityId}/version/${version.version_number}`}
                                            class="text-primary hover:underline"
                                        >
                                            {version.version_number}
                                        </a>
                                    </td>
                                    <td class="p-2">
                                        {new Date(version.created_at).toLocaleDateString()}
                                    </td>
                                    <td class="p-2">{version.username}</td>
                                    <td class="p-2">
                                        <span class={`px-2 py-1 rounded text-sm ${version.review_status === 'approved' ? 'bg-green-100 text-green-800' :
                                            version.review_status === 'rejected' ? 'bg-red-100 text-red-800' :
                                                'bg-yellow-100 text-yellow-800'
                                            }`}>
                                            {version.review_status}
                                        </span>
                                    </td>
                                    <td class="p-2">{version.change_message}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </main>
        </Layout>
    );
};