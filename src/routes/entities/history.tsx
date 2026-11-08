import type { Version } from "@wikibricks/cms";
import { cms } from "../../collections";
import { Table, TableHead } from "../../components/table";
import { Layout } from "../../layout";
import { useTranslation, type TranslationFunctions } from "../../translation";
import { getUsernames } from "../../users";
import { isModerator, parseId, routeParam, type DefaultContext } from "../../utils";

const VersionTable = ({
  entityId,
  versions,
  usernames,
  translation: { t, formatDate },
}: {
  entityId: number;
  versions: Version[];
  usernames: Map<number, string>;
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
              href={`/entities/${entityId}?version=${version.versionId}`}
              class="text-primary hover:underline"
            >
              {version.versionNumber}
            </a>
          </td>
          <td>{formatDate(version.createdAt)}</td>
          <td>
            {version.authorId && (
              <a href={`/users/${version.authorId}`}>{usernames.get(version.authorId)}</a>
            )}
          </td>
          <td>{version.changeMessage}</td>
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
  const history = entityId && (await cms.history(entityId));
  if (!entityId || !history) return c.notFound();

  // Pending versions are only visible to moderators and their authors
  const proposals = history.versions.filter(
    (version) =>
      version.status === "pending" && (isModerator(user) || version.authorId === user?.id),
  );
  const approved = history.versions.filter((version) => version.status === "approved");
  const usernames = await getUsernames([...proposals, ...approved].map((version) => version.authorId));

  return c.render(
    <Layout context={c} user={user}>
      <main>
        <h1 class="text-3xl font-serif pb-2 mb-3 border-b">
          {t("entity.history.title")} {history.title}
        </h1>

        {proposals.length > 0 && (
          <div class="pb-2">
            <p class="text-pretty">
              {t("entity.history.requestedChanges", { name: history.title ?? "" })}
            </p>
            <VersionTable
              entityId={entityId}
              versions={proposals}
              usernames={usernames}
              translation={translation}
            />
          </div>
        )}

        <p class="text-pretty">{t("entity.history.versionHistory", { name: history.title ?? "" })}</p>
        <VersionTable
          entityId={entityId}
          versions={approved}
          usernames={usernames}
          translation={translation}
        />
      </main>
    </Layout>,
  );
};
