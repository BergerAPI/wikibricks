import type { Next } from "hono";
import { getCookie, setCookie } from "hono/cookie";
import { cms } from "../collections";
import { Badge, Notice, PageTitle, Row, RowList } from "../components/ui";
import { getUsernames, sql, type AuditEntry, type User } from "../database";
import { Layout } from "../layout";
import { useTranslation, type Translations } from "../translation";
import { isAdmin, isModerator, type DefaultContext } from "../utils";

export const SEEN_COOKIE = "wikibricks_seen";
export const SEEN_COOKIE_DAYS = 365;

// Older notifications are no longer listed
const RECENT_DAYS = 30;
const LIMIT = 50;

/**
 * Something a user should know about. Nothing is stored for it: notifications come from the
 * audit log and the review queue, and a cookie remembers when the user last looked.
 */
type Notification = {
  text: string;
  /** Where to go from it, without the language */
  href?: string;
  date: Date;
  /** Stays until the cause is dealt with, like changes waiting for review */
  ongoing?: boolean;
};

// What is said to the user an entry concerns, instead of the admins' view of it
const personal: Partial<Record<AuditEntry["action"], keyof Translations>> = {
  version_approved: "notify.approved",
  version_rejected: "notify.rejected",
  role_changed: "notify.roleChanged",
};

const auditScope = (user: User, since: Date) => sql`
  created_at > ${since} AND actor_id IS DISTINCT FROM ${user.id}
  ${isAdmin(user) ? sql`` : sql`AND user_id = ${user.id}`}
`;

const loadNotifications = async (c: DefaultContext, user: User, since: Date): Promise<Notification[]> => {
  const { t } = useTranslation(c);
  // Admins follow everything others do, everyone else what concerns them
  const [entries, pending] = await Promise.all([
    sql<AuditEntry[]>`
      SELECT * FROM audit_log
      WHERE ${auditScope(user, since)}
      ORDER BY id DESC LIMIT ${LIMIT}
    `,
    isModerator(user) ? cms.pending(1, { oldestFirst: true }) : [],
  ]);
  const usernames = await getUsernames(entries.map((entry) => entry.actor_id));

  const queue = pending.length > 0
    ? [{ text: t("notify.pending", { count: String(await cms.countPending()) }), href: "/changes", date: pending[0].createdAt, ongoing: true }]
    : [];
  return [
    ...queue,
    ...entries.map((entry) => ({
      text: t((entry.user_id === user.id && personal[entry.action]) || `audit.${entry.action}`, {
        actor: (entry.actor_id && usernames.get(entry.actor_id)) || "–",
        subject: entry.subject,
        name: entry.subject,
        // Role changes are stored as the old and the new role
        role: entry.action === "role_changed" ? t(`user.role.${entry.details.split(">")[1]}` as keyof Translations) : "",
      }),
      href: entry.path ?? (isAdmin(user) ? `/admin?action=${entry.action}` : undefined),
      date: entry.created_at,
    })),
  ];
};

/**
 * When the user last opened the notifications, on this device.
 */
const lastSeen = (c: DefaultContext, user: User) => {
  const [account, timestamp] = (getCookie(c, SEEN_COOKIE) ?? "").split("/", 2);
  const seen = new Date(timestamp);
  return account === String(user.id) && Number.isFinite(seen.getTime()) && seen <= new Date()
    ? seen : new Date(user.created_at);
};

const recentCutoff = (now: Date) => new Date(now.getTime() - RECENT_DAYS * 24 * 60 * 60 * 1000);

/**
 * Counts what is new for the user, for the badge in the header.
 */
export const countNotifications = async (c: DefaultContext, next: Next) => {
  const user = c.get("user");
  // Only pages show the badge, lookups by the page scripts don't need it
  const isInbox = c.req.path === `/${c.get("language")}/notifications`;
  if (user && !isInbox && c.req.method === "GET" && c.req.header("Accept")?.includes("text/html")) {
    const since = new Date(Math.max(lastSeen(c, user).getTime(), recentCutoff(new Date()).getTime()));
    const [[{ count }], pending] = await Promise.all([
      sql<{ count: string }[]>`SELECT COUNT(*) AS count FROM audit_log WHERE ${auditScope(user, since)}`,
      isModerator(user) ? cms.countPending() : 0,
    ]);
    c.set("notifications", Number(count) + Number(pending > 0));
  }
  await next();
};

export const handleNotificationsPage = async (c: DefaultContext) => {
  const user = c.get("user");
  const { t, url, formatDateTime } = useTranslation(c);
  if (!user) return c.redirect(`${url("/login")}?redirect=${encodeURIComponent(url("/notifications"))}`);

  // Notifications stay listed for a while, the ones that are new since the last visit stand out
  const seen = lastSeen(c, user);
  const openedAt = new Date();
  const notifications = await loadNotifications(c, user, recentCutoff(openedAt));
  c.header("Cache-Control", "private, no-store");
  setCookie(c, SEEN_COOKIE, `${user.id}/${openedAt.toISOString()}`, {
    httpOnly: true,
    sameSite: "Lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SEEN_COOKIE_DAYS * 24 * 60 * 60,
  });
  c.set("notifications", notifications.filter((notification) => notification.ongoing).length);

  return c.render(
    <Layout context={c} title={t("notify.title")} noindex>
      <main>
        <PageTitle>{t("notify.title")}</PageTitle>
        {notifications.length === 0 ? <Notice>{t("notify.empty")}</Notice> : (
          <RowList>
            {notifications.map((notification) => {
              const unread = notification.ongoing || notification.date > seen;
              return (
                <Row details={formatDateTime(notification.date)}>
                  {notification.href
                    ? <a href={url(notification.href)} class={unread ? "font-semibold" : ""}>{notification.text}</a>
                    : <span class={unread ? "font-semibold" : ""}>{notification.text}</span>}{" "}
                  {unread && !notification.ongoing && <Badge tone="success">{t("notify.new")}</Badge>}
                </Row>
              );
            })}
          </RowList>
        )}
      </main>
    </Layout>,
  );
};
