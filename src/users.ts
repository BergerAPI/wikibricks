import { sql } from "./database";

/**
 * Usernames by user ID, for showing who wrote or reviewed versions.
 */
export const getUsernames = async (ids: (number | null)[]) => {
  const known = [...new Set(ids.filter((id) => id !== null))];
  if (known.length === 0) return new Map<number, string>();

  const users = await sql<{ id: number; username: string }[]>`
    SELECT id, username FROM users WHERE id IN ${sql(known)}
  `;
  return new Map(users.map((user) => [user.id, user.username]));
};
