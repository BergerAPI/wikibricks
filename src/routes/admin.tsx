import type { PropsWithChildren } from "hono/jsx";
import { cms } from "../collections";
import { Select } from "../components/select";
import { FilterForm, Meta, Notice, PageTitle, Pager, Row, RowList, Tabs } from "../components/ui";
import { auditActions, getUsernames, sql, type AuditEntry, type User } from "../database";
import { Layout } from "../layout";
import { fill, useTranslation, type Translations } from "../translation";
import { entityPath, pageLink, readPage } from "../urls";
import { isAdmin, isModerator, roleOf, ROLES, type DefaultContext, type Role } from "../utils";

const PAGE_SIZE = 50;

const tabs = [
  ["/admin", "admin.overview"],
  ["/changes", "changes.title"],
  ["/admin/users", "admin.users"],
] as const;

/**
 * A page of moderation and administration. Admins get the pages of the admin area as tabs.
 */
const AdminPage = ({ c, current, children }: PropsWithChildren<{ c: DefaultContext; current: (typeof tabs)[number][0] }>) => {
  const { t, url } = useTranslation(c);
  const admin = isAdmin(c.get("user"));
  const title = t(admin ? "admin.title" : "changes.title");
  return (
    <Layout context={c} title={title} noindex>
      <main>
        <PageTitle>{title}</PageTitle>
        {admin && (
          <Tabs
            label={t("admin.title")}
            tabs={tabs.map(([path, label]) => ({ href: url(path), current: path === current, children: t(label) }))}
          />
        )}
        {children}
      </main>
    </Layout>
  );
};

/**
 * Stats and the audit log of what moderators, admins and new accounts did.
 */
export const handleAdminPage = async (c: DefaultContext) => {
  const { t, url, formatDateTime } = useTranslation(c);
  const page = readPage(c, PAGE_SIZE);
  const action = auditActions.find((action) => action === c.req.query("action"));

  const [[stats], pending, entries] = await Promise.all([
    sql<{ users: number; images: number }[]>`
      SELECT (SELECT COUNT(*) FROM users)::int AS users, (SELECT COUNT(*) FROM images)::int AS images
    `,
    cms.countPending(),
    sql<AuditEntry[]>`
      SELECT * FROM audit_log ${action ? sql`WHERE action = ${action}` : sql``}
      ORDER BY id DESC LIMIT ${PAGE_SIZE + 1} OFFSET ${page * PAGE_SIZE}
    `,
  ]);
  const usernames = await getUsernames(entries.map((entry) => entry.actor_id));

  // Roles and types are stored by their key
  const details = (entry: AuditEntry) =>
    entry.action === "role_changed"
      ? entry.details.split(">").map((role) => t(`user.role.${role}` as keyof Translations)).join(" → ")
      : entry.action === "entity_deleted" && cms.isType(entry.details) ? t(`entityType.${entry.details}`) : entry.details;

  return c.render(
    <AdminPage c={c} current="/admin">
      <dl class="mb-6 grid grid-cols-3 gap-3 text-center">
        {([[pending, "status.pending"], [stats.users, "admin.accounts"], [stats.images, "admin.images"]] as const).map(
          ([count, label]) => (
            <div class="border bg-white p-3">
              <dd class="text-2xl font-serif">{count}</dd>
              <dt class="text-sm text-gray-600">{t(label)}</dt>
            </div>
          ),
        )}
      </dl>

      <h2 class="text-xl font-serif mb-2">{t("admin.audit")}</h2>
      <FilterForm action={url("/admin")} button={t("action.search")}>
        <select name="action" aria-label={t("admin.action")}>
          <option value="">{t("admin.allActions")}</option>
          {auditActions.map((option) => (
            <option value={option} selected={option === action}>{t(`audit.label.${option}`)}</option>
          ))}
        </select>
      </FilterForm>

      {entries.length === 0 ? <Notice class="mt-4">{t("admin.noAudit")}</Notice> : (
        <RowList>
          {entries.slice(0, PAGE_SIZE).map((entry) => (
            <Row details={formatDateTime(entry.created_at)}>
              {fill(t(`audit.${entry.action}`), {
                actor: entry.actor_id ? <a href={url(`/users/${entry.actor_id}`)}>{usernames.get(entry.actor_id)}</a> : "–",
                subject: entry.path ? <a href={url(entry.path)}>{entry.subject}</a> : <b class="font-medium">{entry.subject}</b>,
              })}
              {details(entry) && <Meta class="whitespace-pre-wrap">{details(entry)}</Meta>}
            </Row>
          ))}
        </RowList>
      )}
      <Pager page={page} more={entries.length > PAGE_SIZE} pageUrl={(page) => url(pageLink("/admin", { action: action ?? "" }, page))} t={t} />
    </AdminPage>,
  );
};

export const handleAdminUsersPage = async (c: DefaultContext) => {
  const { t, url, formatDate } = useTranslation(c);
  const page = readPage(c, PAGE_SIZE);
  const query = (c.req.query("q") ?? "").trim().slice(0, 64);
  const role = Object.keys(ROLES).find((role) => role === c.req.query("role")) as Role | undefined;

  const users = await sql<Omit<User, "password">[]>`
    SELECT id, username, permission_level, created_at FROM users
    WHERE username ILIKE ${`%${query.replace(/[\\%_]/g, "\\$&")}%`}
      ${role ? sql`AND permission_level = ${ROLES[role]}` : sql``}
    ORDER BY created_at DESC, id DESC
    LIMIT ${PAGE_SIZE + 1} OFFSET ${page * PAGE_SIZE}
  `;

  return c.render(
    <AdminPage c={c} current="/admin/users">
      <FilterForm action={url("/admin/users")} button={t("action.search")}>
        <input type="search" name="q" value={query} aria-label={t("admin.searchUsers")} placeholder={t("admin.searchUsers")} />
        <Select t={t} name="role" aria-label={t("user.permissionLevel")}>
          <option value="">{t("admin.allRoles")}</option>
          {(Object.keys(ROLES) as Role[]).map((option) => (
            <option value={option} selected={option === role}>{t(`user.role.${option}`)}</option>
          ))}
        </Select>
      </FilterForm>

      {users.length === 0 ? <Notice class="mt-4">{t("admin.noUsers")}</Notice> : (
        <RowList>
          {users.slice(0, PAGE_SIZE).map((found) => (
            <Row details={<><span>{t(`user.role.${roleOf(found)}`)}</span>{formatDate(found.created_at)}</>}>
              <a href={url(`/users/${found.id}`)}>{found.username}</a>
            </Row>
          ))}
        </RowList>
      )}
      <Pager page={page} more={users.length > PAGE_SIZE} pageUrl={(page) => url(pageLink("/admin/users", { q: query, role: role ?? "" }, page))} t={t} />
    </AdminPage>,
  );
};

/**
 * The changes waiting for review, oldest first, for moderators.
 */
export const handleChangesPage = async (c: DefaultContext) => {
  const { t, url, formatDateTime } = useTranslation(c);
  if (!isModerator(c.get("user"))) return c.redirect(url("/"));

  const page = readPage(c, PAGE_SIZE);
  const pending = await cms.pending(PAGE_SIZE + 1, { offset: page * PAGE_SIZE, oldestFirst: true });
  if (page > 0 && pending.length === 0) return c.redirect(url("/changes"));
  const usernames = await getUsernames(pending.map((change) => change.authorId));

  return c.render(
    <AdminPage c={c} current="/changes">
      {pending.length === 0 ? <Notice>{t("changes.empty")}</Notice> : (
        <RowList>
          {pending.slice(0, PAGE_SIZE).map((change) => (
            <Row details={formatDateTime(change.createdAt)}>
              <a href={url(`${entityPath(change)}?version=${change.versionId}`)} class="font-medium">{change.title}</a>
              <Meta>
                <span>{t(`entityType.${change.type}`)}</span>
                <span>{t(change.previousVersionId ? "changes.edit" : "changes.new")}</span>
                {change.authorId && <a href={url(`/users/${change.authorId}`)}>{usernames.get(change.authorId)}</a>}
              </Meta>
              {change.changeMessage && <p class="whitespace-pre-wrap">{change.changeMessage}</p>}
            </Row>
          ))}
        </RowList>
      )}
      <Pager page={page} more={pending.length > PAGE_SIZE} pageUrl={(page) => url(pageLink("/changes", {}, page))} t={t} />
    </AdminPage>,
  );
};
