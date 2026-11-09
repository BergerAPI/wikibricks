import { cms } from "../../collections";
import { InfoBox, InfoBoxImage, InfoBoxRow } from "../../components/info-box";
import { Table, TableHead } from "../../components/table";
import { sql, type User } from "../../database";
import { Layout } from "../../layout";
import { parseId, routeParam, type DefaultContext } from "../../utils";
import { useTranslation } from "../../translation";

export const handleUserPage = async (c: DefaultContext) => {
  const currentUser = c.get("user");
  const { t, formatDate } = useTranslation(c);

  const userId = parseId(routeParam(c, "id"));
  if (!userId) return c.notFound();

  const [user] = await sql<Omit<User, "password">[]>`
    SELECT id, username, permission_level, created_at FROM users WHERE id = ${userId}
  `;
  if (!user) return c.notFound();

  const recentActivity = await cms.activity(userId);

  return c.render(
    <Layout context={c} user={currentUser}>
      <main>
        <div class="flex justify-between items-center pb-2 mb-3 border-b">
          <h1 class="text-3xl font-serif">
            {t("user.title")}
            {user.username}
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
              {user.permission_level}
            </InfoBoxRow>
            <InfoBoxRow label={t("user.memberSince")}>
              {formatDate(user.created_at)}
            </InfoBoxRow>
          </InfoBox>

          <section class="min-w-0 w-full md:order-first md:flex-1">
            <h2 class="text-2xl font-serif mb-4">{t("user.recentActivity")}</h2>
            {recentActivity.length === 0 ? (
              <div class="bg-background border p-2 rounded">
                <div class="text-sm text-gray-600">
                  {t("user.noRecentActivity")}
                </div>
              </div>
            ) : (
              <Table>
                <TableHead>
                  <th>{t("user.entity")}</th>
                  <th>{t("user.version")}</th>
                  <th>{t("entities.date")}</th>
                </TableHead>
                <tbody>
                  {recentActivity.map((activity) => (
                    <tr>
                      <td>
                        <a href={`/entities/${activity.entityId}`}>
                          {activity.title}
                        </a>
                      </td>
                      <td>{activity.versionNumber}</td>
                      <td class="whitespace-nowrap">{formatDate(activity.createdAt)}</td>
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
