import { sql, type EntityVersion, type SetView } from "../database";
import { Layout } from "../layout";
import { PermissionLevel, type DefaultContext } from "../utils";

type SetVersionMetaData = SetView & {
  set_name: string;
  username: string;
  old_value: string;
};

const ChangeTable = ({ changes }: { changes: SetVersionMetaData[] }) => (
  <table class="table-auto w-full mt-4 border-collapse border">
    <thead>
      <tr class="[&>th]:border bg-background">
        <th>Set</th>
        <th>Changed By</th>
        <th>Date</th>
        <th></th>
      </tr>
    </thead>
    <tbody>
      {changes.map((change) => {
        return (
          <tr class="[&>td]:border [&>td]:p-1">
            <td>{change.set_name}</td>
            <td>{change.username}</td>
            <td>{new Date(change.created_at).toLocaleString()}</td>
            <td>
              <a href={`/changes/${change.id}`}>View</a>
            </td>
          </tr>
        );
      })}
    </tbody>
  </table>
);

export const handleSetChangesPage = async (c: DefaultContext) => {
  const user = c.get("user");

  if (!user || user.permission_level < PermissionLevel.MODERATOR) {
    return c.redirect("/sets");
  }

  const changes = await sql<SetVersionMetaData[]>`
        SELECT
            v.*,
            e.name as set_name,
            u.username
        FROM entities e
        JOIN entity_versions v ON v.entity_id = e.id
        JOIN sets s ON s.version_id = v.id
        JOIN users u ON v.created_by = u.id
        WHERE v.review_status = 'pending'
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
