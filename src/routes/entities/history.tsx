import { Table, TableHead } from "../../components/table";
import { sql, type EntityVersion } from "../../database";
import { Layout } from "../../layout";
import { useTranslation } from "../../translation";
import type { DefaultContext } from "../../utils";

type VersionWithUser = EntityVersion & {
  username: string;
  user_id: number;
};

export const handleEntityHistoryPage = async (c: DefaultContext) => {
  const user = c.get("user");
  const entityId = c.req.param("id");
  const { t } = useTranslation(c);

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
            WHERE ev.entity_id = ${entityId}
            ORDER BY ev.version_number DESC
        `,
  ]);

  if (!entityInfo) return c.notFound();

  const proposedVersion = versions.filter(
    (it) => it.review_status === "pending",
  );

  return c.render(
    <Layout context={c} user={user}>
      <main>
        <h1 class="text-3xl font-serif pb-2 mb-3 border-b">
          {t("entity.history.title")} {entityInfo.name}
        </h1>

        {proposedVersion.length > 0 && (
          <>
            <p class="text-pretty">
              {t("entity.history.requestedChanges", { name: entityInfo.name })}
            </p>

            <div class="pb-2">
              <Table>
                <TableHead>
                  <th>{t("entity.history.version")}</th>
                  <th>{t("entity.history.created")}</th>
                  <th>{t("entity.history.author")}</th>
                  <th>{t("entity.history.changeMessage")}</th>
                </TableHead>
                <tbody>
                  {proposedVersion.map((version) => (
                    <tr>
                      <td>
                        <a
                          href={`/entities/${entityId}?version=${version.id}`}
                          class="text-primary hover:underline"
                        >
                          {version.id}
                        </a>
                      </td>
                      <td>{version.created_at.toLocaleDateString()}</td>
                      <td>
                        <a href={`/users/${version.user_id}`}>
                          {version.username}
                        </a>
                      </td>
                      <td>{version.change_message}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          </>
        )}

        <p class="text-pretty">
          {t("entity.history.versionHistory", { name: entityInfo.name })}
        </p>

        <div>
          <Table>
            <TableHead>
              <th>{t("entity.history.version")}</th>
              <th>{t("entity.history.created")}</th>
              <th>{t("entity.history.author")}</th>
              <th>{t("entity.history.changeMessage")}</th>
            </TableHead>
            <tbody>
              {versions
                .filter((it) => it.review_status === "approved")
                .map((version) => (
                  <tr>
                    <td>
                      <a
                        href={`/entities/${entityId}?version=${version.id}`}
                        class="text-primary hover:underline"
                      >
                        {version.id}
                      </a>
                    </td>
                    <td>{version.created_at.toLocaleDateString()}</td>
                    <td>
                      <a href={`/users/${version.user_id}`}>
                        {version.username}
                      </a>
                    </td>
                    <td>{version.change_message}</td>
                  </tr>
                ))}
            </tbody>
          </Table>
        </div>
      </main>
    </Layout>,
  );
};
