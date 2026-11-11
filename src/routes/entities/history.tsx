import type { Version } from "@wikibricks/cms";
import { cms } from "../../collections";
import { Table, TableHead } from "../../components/table";
import { Layout } from "../../layout";
import { useTranslation, type TranslationFunctions } from "../../translation";
import { getUsernames } from "../../users";
import { isModerator, parseId, routeParam, type DefaultContext } from "../../utils";

const UserLink = ({ id, usernames }: { id: number | null; usernames: Map<number, string> }) =>
  id ? <a href={`/users/${id}`}>{usernames.get(id)}</a> : null;

const VersionTable = ({
  entityId,
  versions,
  usernames,
  reviewed,
  translation: { t, formatDate },
}: {
  entityId: number;
  versions: Version[];
  usernames: Map<number, string>;
  /** Adds who reviewed each version and what they said */
  reviewed?: boolean;
  translation: TranslationFunctions;
}) => (
  <Table>
    <TableHead>
      <th>{t("entity.history.version")}</th>
      <th>{t("entity.history.created")}</th>
      <th>{t("entity.history.author")}</th>
      <th>{t("entity.history.changeMessage")}</th>
      {reviewed && <th>{t("entity.history.reviewer")}</th>}
      {reviewed && <th>{t("entity.history.reviewComment")}</th>}
    </TableHead>
    <tbody>
      {versions.map((version) => (
        <tr>
          <td>
            <a href={`/entities/${entityId}?version=${version.versionId}`}>{version.versionNumber}</a>
          </td>
          <td class="whitespace-nowrap">{formatDate(version.createdAt)}</td>
          <td>
            <UserLink id={version.authorId} usernames={usernames} />
          </td>
          <td>{version.changeMessage}</td>
          {reviewed && (
            <td>
              <UserLink id={version.reviewerId} usernames={usernames} />
            </td>
          )}
          {reviewed && <td>{version.reviewComment}</td>}
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

  // Versions that were never approved are only visible to moderators and their authors
  const isVisible = (version: Version) => isModerator(user) || version.authorId === user?.id;
  const withStatus = (status: Version["status"]) => history.versions.filter((version) => version.status === status);
  const proposals = withStatus("pending").filter(isVisible);
  const rejected = withStatus("rejected").filter(isVisible);
  const approved = withStatus("approved");

  const shown = [...proposals, ...rejected, ...approved];
  const usernames = await getUsernames(shown.flatMap((version) => [version.authorId, version.reviewerId]));
  const name = history.title ?? "";

  return c.render(
    <Layout context={c} user={user}>
      <main>
        <h1 class="text-3xl font-serif pb-2 mb-3 border-b">
          {t("entity.history.title")} {name}
        </h1>

        {proposals.length > 0 && (
          <div class="pb-4">
            <p class="text-pretty">{t("entity.history.requestedChanges", { name })}</p>
            <VersionTable entityId={entityId} versions={proposals} usernames={usernames} translation={translation} />
          </div>
        )}

        <p class="text-pretty">{t("entity.history.versionHistory", { name })}</p>
        <VersionTable entityId={entityId} versions={approved} usernames={usernames} reviewed translation={translation} />

        {rejected.length > 0 && (
          <div class="pt-4">
            <p class="text-pretty">{t("entity.history.rejected", { name })}</p>
            <VersionTable entityId={entityId} versions={rejected} usernames={usernames} reviewed translation={translation} />
          </div>
        )}
      </main>
    </Layout>,
  );
};
