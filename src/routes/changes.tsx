import { Table, TableHead } from "../components/table";
import { sql, type EntityVersion, type SetView } from "../database";
import { Layout } from "../layout";
import { PermissionLevel, type DefaultContext } from "../utils";

type EntityVersionMetaData = EntityVersion & {
  entity_title: string;
  username: string;
  user_id: string;
};

const ChangeTable = ({ changes }: { changes: EntityVersionMetaData[] }) => (
  <Table>
    <TableHead>
      <th>Set</th>
      <th>Changed By</th>
      <th>Message</th>
      <th>Date</th>
    </TableHead>

    <tbody>
      {changes.map((change) => {
        return (
          <tr>
            <td>
              <a href={`/entities/${change.entity_id}?version=${change.id}`}>
                {change.entity_title}
              </a>
            </td>
            <td>
              <a href={`/users/${change.user_id}`}>
                {change.username}
              </a>
            </td>
            <td>
              {change.change_message || <em>No message</em>}
            </td>
            <td>{new Date(change.created_at).toLocaleString()}</td>
          </tr>
        );
      })}
    </tbody>
  </Table>
);

export const handleSetChangesPage = async (c: DefaultContext) => {
  const user = c.get("user");

  if (!user || user.permission_level < PermissionLevel.MODERATOR) {
    return c.redirect("/sets");
  }

  const changes = await sql<EntityVersionMetaData[]>`
        SELECT 
          ev.*,
          u.username,
          e.name as entity_title,
          u.id as user_id
        FROM entity_versions ev
        JOIN entities e ON ev.entity_id = e.id
        LEFT JOIN users u ON ev.created_by = u.id
        WHERE ev.review_status = 'pending'
        ORDER BY ev.version_number DESC
    `;

  return c.render(
    <Layout user={user}>
      <main>
        <h1 class="text-3xl font-serif pb-2 mb-3 border-b">Change Requests</h1>
        <div class="min-w-full overflow-x-auto">
          <ChangeTable changes={changes} />
        </div>
      </main>
    </Layout>,
  );
};
