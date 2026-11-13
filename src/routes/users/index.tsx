import { cms } from "../../collections";
import { Select } from "../../components/select";
import { InfoBox, InfoBoxImage, InfoBoxRow, Notice, PageTitle, Pager, Row, RowList } from "../../components/ui";
import { recordAudit, sql, type User } from "../../database";
import { Layout } from "../../layout";
import { useTranslation } from "../../translation";
import { entityPath, pageLink, readPage } from "../../urls";
import { isAdmin, isModerator, parseId, roleOf, ROLES, routeParam, type DefaultContext, type Role } from "../../utils";

const ACTIVITY_LENGTH = 20;

export const handleUserPage = async (c: DefaultContext) => {
  const currentUser = c.get("user");
  const { t, url, formatDate } = useTranslation(c);

  const userId = parseId(routeParam(c, "id"));
  if (!userId) return c.notFound();

  const [user] = await sql<Omit<User, "password">[]>`
    SELECT id, username, permission_level, created_at FROM users WHERE id = ${userId}
  `;
  if (!user) return c.notFound();

  // Changes that were never approved are only for moderators and the user who made them
  const seesReviews = isModerator(currentUser) || currentUser?.id === user.id;
  const page = readPage(c, ACTIVITY_LENGTH);
  const activity = await cms.activity(userId, ACTIVITY_LENGTH + 1, { offset: page * ACTIVITY_LENGTH, approvedOnly: !seesReviews });
  // Admins can't change their own role, so there is always one left
  const canChangeRole = isAdmin(currentUser) && currentUser?.id !== user.id;

  return c.render(
    <Layout context={c} title={`${user.username}`} noindex>
      <main>
        <PageTitle>{t("user.title")} {user.username}</PageTitle>

        {c.req.query("roleChanged") !== undefined && <Notice tone="success" role="status">{t("user.roleChanged")}</Notice>}

        <div class="flex flex-col items-start gap-4 md:flex-row md:gap-0">
          <InfoBox title={user.username}>
            <InfoBoxImage
              class="max-w-40"
              src={`https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(user.username)}`}
              alt={`${t("user.imageOf")} ${user.username}`}
            />

            <InfoBoxRow label={t("user.permissionLevel")}>
              {canChangeRole ? (
                <form method="post" action={url(`/users/${user.id}/role`)} class="space-y-2">
                  <Select t={t} name="role" aria-label={t("user.permissionLevel")} class="w-full">
                    {(Object.keys(ROLES) as Role[]).map((role) => (
                      <option value={role} selected={role === roleOf(user)}>{t(`user.role.${role}`)}</option>
                    ))}
                  </Select>
                  <button type="submit" class="button-secondary w-full">{t("user.changeRole")}</button>
                </form>
              ) : (
                t(`user.role.${roleOf(user)}`)
              )}
            </InfoBoxRow>
            <InfoBoxRow label={t("user.memberSince")}>{formatDate(user.created_at)}</InfoBoxRow>
          </InfoBox>

          <section class="min-w-0 w-full md:order-first md:flex-1">
            <h2 class="text-2xl font-serif mb-4">{t("user.recentActivity")}</h2>
            {activity.length === 0 ? (
              <Notice>{t("user.noRecentActivity")}</Notice>
            ) : (
              <RowList>
                {activity.slice(0, ACTIVITY_LENGTH).map((version) => (
                  <Row
                    details={<>
                      <span>{t("user.version")} {version.versionNumber}</span>
                      {seesReviews && <span>{t(`status.${version.status}`)}</span>}
                      {formatDate(version.createdAt)}
                    </>}
                  >
                    <a href={url(`${entityPath(version)}?version=${version.versionId}`)}>{version.title}</a>
                  </Row>
                ))}
              </RowList>
            )}
            <Pager
              page={page}
              more={activity.length > ACTIVITY_LENGTH}
              pageUrl={(page) => url(pageLink(`/users/${user.id}`, {}, page))}
              t={t}
            />
          </section>
        </div>
      </main>
    </Layout>,
  );
};

export const handleUserRoleSubmit = async (c: DefaultContext) => {
  const admin = c.get("user");
  if (!admin || !isAdmin(admin)) return c.text("Forbidden", 403);

  const userId = parseId(routeParam(c, "id"));
  if (!userId || userId === admin.id) return c.text("Bad Request", 400);
  const body = await c.req.parseBody().catch(() => undefined);
  const role = (Object.keys(ROLES) as Role[]).find((key) => key === body?.role);
  if (!role) return c.text("Bad Request", 400);

  const changed = await sql.begin(async (tx) => {
    // Serialize role changes and recheck the acting admin inside the transaction.
    const accounts = await tx<Pick<User, "id" | "username" | "permission_level">[]>`
      SELECT id, username, permission_level FROM users
      WHERE id IN (${userId}, ${admin.id}) ORDER BY id FOR UPDATE
    `;
    if (!isAdmin(accounts.find((account) => account.id === admin.id))) return "forbidden";
    const user = accounts.find((account) => account.id === userId);
    if (!user) return "missing";
    if (roleOf(user) === role) return "unchanged";

    await tx`UPDATE users SET permission_level = ${ROLES[role]} WHERE id = ${userId}`;
    await recordAudit(tx, {
      actorId: admin.id,
      userId,
      action: "role_changed",
      subject: user.username,
      path: `/users/${userId}`,
      details: `${roleOf(user)}>${role}`,
    });
    return "changed";
  });
  if (changed === "forbidden") return c.text("Forbidden", 403);
  if (changed === "missing") return c.notFound();
  return c.redirect(useTranslation(c).url(`/users/${userId}${changed === "changed" ? "?roleChanged" : ""}`), 303);
};
