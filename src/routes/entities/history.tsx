import { Table, TableHead } from "../../components/table";
import { sql, type EntityVersion } from "../../database";
import { Layout } from "../../layout";
import type { DefaultContext } from "../../utils";

type VersionWithUser = EntityVersion & {
    username: string;
    user_id: number;
};

export const handleEntityHistoryPage = async (c: DefaultContext) => {
    const user = c.get("user");
    const entityId = c.req.param("id");

    // Fetch entity versions with usernames
    const [[entityInfo], versions] = await Promise.all([
        sql<{ name: string }[]>`
            SELECT name FROM entities WHERE id = ${entityId}
        `,
        sql<VersionWithUser[]>`
            SELECT 
                ev.*,
                u.username,
                u.id as user_id
            FROM entity_versions ev
            LEFT JOIN users u ON ev.created_by = u.id
            WHERE ev.entity_id = ${entityId} AND ev.review_status = 'approved'
            ORDER BY ev.version_number DESC
        `
    ]);

    if (!entityInfo) return c.notFound();

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
                            <th>Change Message</th>
                        </TableHead>
                        <tbody>
                            {versions.map((version) => (
                                <tr>
                                    <td>
                                        <a
                                            href={`/entities/${entityId}?version=${version.id}`}
                                            class="text-primary hover:underline"
                                        >
                                            {version.id}
                                        </a>
                                    </td>
                                    <td >
                                        {version.created_at.toLocaleDateString()}
                                    </td>
                                    <td>
                                        <a href={`/users/${version.user_id}`}>{version.username}</a>
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