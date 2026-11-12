import type { Next } from "hono";
import { cms } from "../collections";
import { Table, TableHead } from "../components/table";
import { Layout } from "../layout";
import { useTranslation } from "../translation";
import { getUsernames } from "../users";
import { isModerator, type DefaultContext } from "../utils";

const PAGE_SIZE = 50;

/**
 * Tells moderators on every page how many changes wait for them, shown next to the link to the queue.
 */
export const countPendingChanges = async (c: DefaultContext, next: Next) => {
  if (c.req.method === "GET" && isModerator(c.get("user"))) c.set("pendingChanges", await cms.countPending());
  await next();
};

export const handleChangesPage = async (c: DefaultContext) => {
  const user = c.get("user");
  const { t, formatDateTime } = useTranslation(c);

  if (!isModerator(user)) return c.redirect("/");

  const requestedPage = Number(c.req.query("page"));
  const page = Number.isInteger(requestedPage) && requestedPage > 0 && Number.isSafeInteger(requestedPage * PAGE_SIZE)
    ? requestedPage : 0;
  const pending = await cms.pending(PAGE_SIZE + 1, { offset: page * PAGE_SIZE, oldestFirst: true });
  if (page > 0 && pending.length === 0) return c.redirect("/changes");

  const changes = pending.slice(0, PAGE_SIZE);
  const usernames = await getUsernames(changes.map((change) => change.authorId));
  const pageUrl = (index: number) => index === 0 ? "/changes" : `/changes?page=${index}`;

  return c.render(
    <Layout context={c} user={user}>
      <main>
        <h1 class="text-3xl font-serif pb-2 mb-3 border-b">{t("changes.title")}</h1>
        {changes.length === 0 ? (
          <p>{t("changes.empty")}</p>
        ) : (
          <Table>
            <TableHead>
              <th>{t("entities.name")}</th>
              <th>{t("entities.type")}</th>
              <th>{t("changes.kind")}</th>
              <th>{t("changes.changedBy")}</th>
              <th>{t("changes.message")}</th>
              <th>{t("entities.date")}</th>
            </TableHead>
            <tbody>
              {changes.map((change) => (
                <tr>
                  <td>
                    <a href={`/entities/${change.entityId}?version=${change.versionId}`}>{change.title}</a>
                  </td>
                  <td>{t(`entityType.${change.type}`)}</td>
                  <td>{t(change.previousVersionId ? "changes.edit" : "changes.new")}</td>
                  <td>
                    {change.authorId && <a href={`/users/${change.authorId}`}>{usernames.get(change.authorId)}</a>}
                  </td>
                  <td>{change.changeMessage}</td>
                  <td class="whitespace-nowrap">{formatDateTime(change.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
        <div class="mt-4 flex flex-wrap justify-center gap-3 [&>a]:inline-flex [&>a]:min-h-11 [&>a]:items-center [&>a]:border [&>a]:px-3">
          {page > 0 && <a rel="prev" href={pageUrl(page - 1)}>{t("action.previous")}</a>}
          {pending.length > PAGE_SIZE && <a rel="next" href={pageUrl(page + 1)}>{t("action.next")}</a>}
        </div>
      </main>
    </Layout>,
  );
};
