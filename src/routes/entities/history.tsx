import type { Version } from "@wikibricks/cms";
import { cms } from "../../collections";
import { Badge, Meta, PageTitle, Pager } from "../../components/ui";
import { Layout } from "../../layout";
import { useTranslation } from "../../translation";
import { entityPath, pageLink, parseEntityId, readPage } from "../../urls";
import { getUsernames } from "../../database";
import { isModerator, routeParam, type DefaultContext } from "../../utils";

const PAGE_SIZE = 25;

// How each version is marked on the timeline
const marks = {
  current: { dot: "bg-green-500", tone: "success" },
  pending: { dot: "bg-yellow-400", tone: "warning" },
  approved: { dot: "bg-gray-300", tone: "plain" },
  rejected: { dot: "bg-red-400", tone: "error" },
} as const;

export const handleEntityHistoryPage = async (c: DefaultContext) => {
  const user = c.get("user");
  const { t, url, formatDateTime } = useTranslation(c);

  const entityId = parseEntityId(routeParam(c, "id"));
  if (!entityId) return c.notFound();
  const page = readPage(c, PAGE_SIZE);
  // Versions that were never approved are only visible to moderators and their authors
  const unapproved = isModerator(user) ? "all" : user ? { authorId: user.id } : "none";
  if (user) c.header("Cache-Control", "private, no-store");
  const history = await cms.history(entityId, PAGE_SIZE + 1, { offset: page * PAGE_SIZE, unapproved });
  if (!history || (page > 0 && history.versions.length === 0)) return c.notFound();

  const name = history.title ?? "";
  const entityUrl = url(entityPath({ entityId, title: history.title }));
  if (c.req.path !== `${entityUrl}/history`)
    return c.redirect(`${entityUrl}/history${new URL(c.req.url).search}`, history.headVersionId === null ? 302 : 301);

  const versions = history.versions.slice(0, PAGE_SIZE);
  const usernames = await getUsernames(versions.flatMap((version) => [version.authorId, version.reviewerId]));

  const UserLink = ({ id }: { id: number }) => <a href={url(`/users/${id}`)}>{usernames.get(id)}</a>;

  const VersionItem = ({ version }: { version: Version }) => {
    const isCurrent = version.versionId === history.headVersionId;
    const mark = marks[isCurrent ? "current" : version.status];
    return (
      <li class="relative pb-6 pl-6 last:pb-0">
        <span class={`absolute -left-[7px] top-1.5 size-3 rounded-full ring-4 ring-white ${mark.dot}`}></span>
        <div class="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <a href={isCurrent ? entityUrl : `${entityUrl}?version=${version.versionId}`} class="font-semibold">
            {t("entity.history.version")} {version.versionNumber}
          </a>
          {mark.tone !== "plain" && (
            <Badge tone={mark.tone}>{isCurrent ? t("entity.currentVersion") : t(`status.${version.status}`)}</Badge>
          )}
          <span class="text-sm text-gray-600">{formatDateTime(version.createdAt)}</span>
        </div>
        <p class="mt-1 whitespace-pre-wrap">
          {version.changeMessage || (!version.previousVersionId && t("review.newEntity"))}
        </p>
        <Meta class="mt-1">
          {version.authorId && <span>{t("entity.history.author")}: <UserLink id={version.authorId} /></span>}
          {version.reviewerId && <span>{t("entity.history.reviewer")}: <UserLink id={version.reviewerId} /></span>}
        </Meta>
        {version.reviewComment && (
          <p class="mt-1 border-l-2 pl-2 text-sm text-gray-600 whitespace-pre-wrap">{version.reviewComment}</p>
        )}
      </li>
    );
  };

  return c.render(
    <Layout context={c} title={`${t("entity.history.title")} ${name}`} noindex>
      <main>
        <PageTitle>{t("entity.history.title")} <a href={entityUrl}>{name}</a></PageTitle>

        <ol class="mt-5 ml-2 max-w-3xl list-none space-y-0 border-l-2 p-0">
          {versions.map((version) => <VersionItem version={version} />)}
        </ol>
        <Pager
          page={page}
          more={history.versions.length > PAGE_SIZE}
          pageUrl={(page) => pageLink(`${entityUrl}/history`, {}, page)}
          t={t}
        />
      </main>
    </Layout>,
  );
};
