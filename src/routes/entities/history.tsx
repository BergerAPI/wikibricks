import { Table, TableHead } from "../../components/table";
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
                    <Table>
                        <TableHead>
                            <th>Version</th>
                            <th>Created</th>
                            <th>Author</th>
                            <th>Status</th>
                            <th>Change Message</th>
                        </TableHead>
                        <tbody>
                            {versions.map((version) => (
                                <tr>
                                    <td>
                                        <a
                                            href={`/entities/${entityId}/version/${version.version_number}`}
                                            class="text-primary hover:underline"
                                        >
                                            {version.version_number}
                                        </a>
                                    </td>
                                    <td >
                                        {new Date(version.created_at).toLocaleDateString()}
                                    </td>
                                    <td>{version.username}</td>
                                    <td >
                                        <span class={`px-2 py-1 rounded text-sm ${version.review_status === 'approved' ? 'bg-green-100 text-green-800' :
                                            version.review_status === 'rejected' ? 'bg-red-100 text-red-800' :
                                                'bg-yellow-100 text-yellow-800'
                                            }`}>
                                            {version.review_status}
                                        </span>
                                    </td>
                                    <td>{version.change_message}</td>
                                </tr>
                            ))}
                        </tbody>
                    </Table>
                </div>
            </main>
        </Layout>
    );
};