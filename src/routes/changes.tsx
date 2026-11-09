import { cms } from "../collections";
import { Table, TableHead } from "../components/table";
import { Layout } from "../layout";
import { useTranslation } from "../translation";
import { getUsernames } from "../users";
import { isModerator, type DefaultContext } from "../utils";

export const handleChangesPage = async (c: DefaultContext) => {
  const user = c.get("user");
  const { t, formatDateTime } = useTranslation(c);

  if (!isModerator(user)) return c.redirect("/");

  const changes = await cms.pending();
  const usernames = await getUsernames(changes.map((change) => change.authorId));

  return c.render(
    <Layout context={c} user={user}>
      <main>
        <h1 class="text-3xl font-serif pb-2 mb-3 border-b">{t("changes.title")}</h1>
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
                  <a href={`/entities/${change.entityId}?version=${change.versionId}`}>
                    {change.title}
                  </a>
                </td>
                <td>
                  {change.authorId && (
                    <a href={`/users/${change.authorId}`}>{usernames.get(change.authorId)}</a>
                  )}
                </td>
                <td>{change.changeMessage || <em>{t("error.noMessage")}</em>}</td>
                <td class="whitespace-nowrap">{formatDateTime(change.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      </main>
    </Layout>,
  );
};
