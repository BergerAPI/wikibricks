import { cms } from "../../collections";
import { InfoBox, InfoBoxImage, InfoBoxRow } from "../../components/info-box";
import { Table, TableHead } from "../../components/table";
import { sql, type User } from "../../database";
import { Layout } from "../../layout";
import { useTranslation } from "../../translation";
import { isAdmin, isModerator, parseId, roleOf, ROLES, routeParam, type DefaultContext, type Role } from "../../utils";

const ACTIVITY_LENGTH = 10;

export const handleUserPage = async (c: DefaultContext) => {
  const currentUser = c.get("user");
  const { t, formatDate } = useTranslation(c);

  const userId = parseId(routeParam(c, "id"));
  if (!userId) return c.notFound();

  const [user] = await sql<Omit<User, "password">[]>`
    SELECT id, username, permission_level, created_at FROM users WHERE id = ${userId}
  `;
  if (!user) return c.notFound();

  // Changes that were never approved are only for moderators and the user who made them
  const seesReviews = isModerator(currentUser) || currentUser?.id === user.id;
  const activity = (await cms.activity(userId, seesReviews ? ACTIVITY_LENGTH : 5 * ACTIVITY_LENGTH))
    .filter((version) => seesReviews || version.status === "approved")
    .slice(0, ACTIVITY_LENGTH);
  // Admins can't change their own role, so there is always one left
  const canChangeRole = isAdmin(currentUser) && currentUser?.id !== user.id;

  return c.render(
    <Layout context={c} user={currentUser}>
      <main>
        <div class="flex justify-between items-center pb-2 mb-3 border-b">
          <h1 class="text-3xl font-serif">
            {t("user.title")} {user.username}
          </h1>
        </div>

        <div class="flex flex-col items-start gap-4 md:flex-row md:gap-0">
          <InfoBox title={user.username}>
            <InfoBoxImage
              class="max-w-40"
              src={`https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(user.username)}`}
              alt={`${t("user.imageOf")} ${user.username}`}
            />

            <InfoBoxRow label={t("user.userId")}>{user.id}</InfoBoxRow>
            <InfoBoxRow label={t("user.permissionLevel")}>
              {canChangeRole ? (
                <form method="post" action={`/users/${user.id}/role`} class="space-y-2">
                  <select name="role" aria-label={t("user.permissionLevel")} class="w-full">
                    {(Object.keys(ROLES) as Role[]).map((role) => (
                      <option value={role} selected={role === roleOf(user)}>{t(`user.role.${role}`)}</option>
                    ))}
                  </select>
                  <button type="submit" class="w-full bg-gray-100 hover:bg-gray-200">{t("user.changeRole")}</button>
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
              <p class="bg-background border p-2 text-sm text-gray-600">{t("user.noRecentActivity")}</p>
            ) : (
              <Table>
                <TableHead>
                  <th>{t("user.entity")}</th>
                  <th>{t("user.version")}</th>
                  {seesReviews && <th>{t("user.status")}</th>}
                  <th>{t("entities.date")}</th>
                </TableHead>
                <tbody>
                  {activity.map((version) => (
                    <tr>
                      <td>
                        <a href={`/entities/${version.entityId}?version=${version.versionId}`}>{version.title}</a>
                      </td>
                      <td>{version.versionNumber}</td>
                      {seesReviews && <td>{t(`status.${version.status}`)}</td>}
                      <td class="whitespace-nowrap">{formatDate(version.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </section>
        </div>
      </main>
    </Layout>,
  );
};

export const handleUserRoleSubmit = async (c: DefaultContext) => {
  const admin = c.get("user");
  if (!isAdmin(admin)) return c.text("Forbidden", 403);

  const userId = parseId(routeParam(c, "id"));
  const { role } = await c.req.parseBody();
  if (!userId || userId === admin!.id || typeof role !== "string" || !Object.hasOwn(ROLES, role))
    return c.text("Bad Request", 400);

  await sql`UPDATE users SET permission_level = ${ROLES[role as Role]} WHERE id = ${userId}`;
  return c.redirect(`/users/${userId}`, 303);
};
