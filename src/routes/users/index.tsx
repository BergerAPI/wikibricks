import { InfoBox, InfoBoxImage, InfoBoxRow } from "../../components/info-box";
import { Table, TableHead } from "../../components/table";
import { sql, type User } from "../../database";
import { Layout } from "../../layout";
import type { DefaultContext } from "../../utils";

export const handleUserPage = async (c: DefaultContext) => {
    const currentUser = c.get("user");
    const userId = c.req.param("id");

    // Fetch user from database
    const [user] = await sql<User[]>`
        SELECT id, username, permission_level, created_at
        FROM users 
        WHERE id = ${userId}
    `;

    if (!user) return c.notFound();

    const recentActivity = await sql<{ entity_name: string, entity_id: number, created_at: Date, version_number: number }[]>`
        SELECT 
            e.name as entity_name,
            e.id as entity_id, 
            v.created_at,
            v.version_number
        FROM entity_versions v
        JOIN entities e ON v.entity_id = e.id
        WHERE v.created_by = ${userId}
        ORDER BY v.created_at DESC
        LIMIT 10
    `;

    return c.render(
        <Layout user={currentUser}>
            <main class="overflow-auto">
                <div class="flex justify-between items-center pb-2 mb-3 border-b">
                    <h1 class="text-3xl font-serif">User:{user.username}</h1>
                </div>

                <div class="flex">
                    <section class="flex-1">
                        <h2 class="text-2xl font-serif mb-4">Recent Activity</h2>
                        {recentActivity.length === 0 ? (
                            <div class="bg-background border p-2 rounded">
                                <div class="text-sm text-gray-600">No recent activity</div>
                            </div>
                        ) : (
                            <Table>
                                <TableHead>
                                    <th>Entity</th>
                                    <th>Version</th>
                                    <th>Date</th>
                                </TableHead>
                                <tbody>
                                    {recentActivity.map(activity => (
                                        <tr>
                                            <td>
                                                <a href={`/entities/${activity.entity_id}`}>
                                                    {activity.entity_name}
                                                </a>
                                            </td>
                                            <td>{activity.version_number}</td>
                                            <td>{activity.created_at.toLocaleDateString()}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </Table>
                        )}
                    </section>

                    <InfoBox title={user.username}>
                        <InfoBoxImage
                            src={`https://api.dicebear.com/7.x/identicon/svg?seed=${user.username}`}
                            alt={`Image of ${user.username}`} />

                        <InfoBoxRow label="User ID">{user.id}</InfoBoxRow>
                        <InfoBoxRow label="Permission Level">{user.permission_level}</InfoBoxRow>
                        <InfoBoxRow label="Member Since">{user.created_at.toLocaleDateString()}</InfoBoxRow>
                    </InfoBox>
                </div>
            </main>
        </Layout>
    );
};