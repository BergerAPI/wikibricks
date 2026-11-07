import { Table, TableHead } from "../components/table";
import { sql, type EntityVersion } from "../database";
import { Layout } from "../layout";
import { useTranslation } from "../translation";
import { isModerator, type DefaultContext } from "../utils";

type PendingChange = EntityVersion & { entity_name: string; username: string };

export const handleChangesPage = async (c: DefaultContext) => {
  const user = c.get("user");
  const { t, formatDateTime } = useTranslation(c);

  if (!isModerator(user)) return c.redirect("/");

  const changes = await sql<PendingChange[]>`
    SELECT v.*, u.username, e.name AS entity_name
    FROM entity_versions v
    JOIN entities e ON v.entity_id = e.id
    LEFT JOIN users u ON v.created_by = u.id
    WHERE v.review_status = 'pending'
    ORDER BY v.created_at DESC, v.id DESC
    LIMIT 100
  `;

  return c.render(
    <Layout context={c} user={user}>
      <main>
        <h1 class="text-3xl font-serif pb-2 mb-3 border-b">{t("changes.title")}</h1>
        <div class="min-w-full overflow-x-auto">
          <Table>
            <TableHead>
              <th>{t("changes.set")}</th>
              <th>{t("changes.changedBy")}</th>
              <th>{t("changes.message")}</th>
              <th>{t("entities.date")}</th>
            </TableHead>
            <tbody>
              {changes.map((change) => (
                <tr>
                  <td>
                    <a href={`/entities/${change.entity_id}?version=${change.id}`}>
                      {change.entity_name}
                    </a>
                  </td>
                  <td>
                    <a href={`/users/${change.created_by}`}>{change.username}</a>
                  </td>
                  <td>{change.change_message || <em>{t("error.noMessage")}</em>}</td>
                  <td>{formatDateTime(change.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      </main>
    </Layout>,
  );
};
