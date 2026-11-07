import { Table, TableHead } from "../../components/table";
import { sql, type EntityVersion } from "../../database";
import { Layout } from "../../layout";
import { useTranslation, type TranslationFunctions } from "../../translation";
import { isModerator, parseId, routeParam, type DefaultContext } from "../../utils";

type VersionWithUser = EntityVersion & { username: string };

const VersionTable = ({
  entityId,
  versions,
  translation: { t, formatDate },
}: {
  entityId: number;
  versions: VersionWithUser[];
  translation: TranslationFunctions;
}) => (
  <Table>
    <TableHead>
      <th>{t("entity.history.version")}</th>
      <th>{t("entity.history.created")}</th>
      <th>{t("entity.history.author")}</th>
      <th>{t("entity.history.changeMessage")}</th>
    </TableHead>
    <tbody>
      {versions.map((version) => (
        <tr>
          <td>
            <a
              href={`/entities/${entityId}?version=${version.id}`}
              class="text-primary hover:underline"
            >
              {version.version_number}
            </a>
          </td>
          <td>{formatDate(version.created_at)}</td>
          <td>
            <a href={`/users/${version.created_by}`}>{version.username}</a>
          </td>
          <td>{version.change_message}</td>
        </tr>
      ))}
    </tbody>
  </Table>
);

export const handleEntityHistoryPage = async (c: DefaultContext) => {
  const user = c.get("user");
  const translation = useTranslation(c);
  const { t } = translation;

  const entityId = parseId(routeParam(c, "id"));
  if (!entityId) return c.notFound();

  const [[entity], versions] = await Promise.all([
    sql<{ name: string }[]>`SELECT name FROM entities WHERE id = ${entityId}`,
    sql<VersionWithUser[]>`
      SELECT v.*, u.username
      FROM entity_versions v
      LEFT JOIN users u ON v.created_by = u.id
      WHERE v.entity_id = ${entityId}
      ORDER BY v.version_number DESC, v.id DESC
      LIMIT 100
    `,
  ]);
  if (!entity) return c.notFound();

  // Pending versions are only visible to moderators and their authors
  const proposals = versions.filter(
    (version) =>
      version.review_status === "pending" && (isModerator(user) || version.created_by === user?.id),
  );
  const approved = versions.filter((version) => version.review_status === "approved");

  return c.render(
    <Layout context={c} user={user}>
      <main>
        <h1 class="text-3xl font-serif pb-2 mb-3 border-b">
          {t("entity.history.title")} {entity.name}
        </h1>

        {proposals.length > 0 && (
          <div class="pb-2">
            <p class="text-pretty">
              {t("entity.history.requestedChanges", { name: entity.name })}
            </p>
            <VersionTable entityId={entityId} versions={proposals} translation={translation} />
          </div>
        )}

        <p class="text-pretty">{t("entity.history.versionHistory", { name: entity.name })}</p>
        <VersionTable entityId={entityId} versions={approved} translation={translation} />
      </main>
    </Layout>,
  );
};
