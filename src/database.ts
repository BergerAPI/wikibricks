import postgres from "postgres";

/**
 * A row of the users table
 */
export type User = {
  id: number;
  username: string;
  password: string;
  permission_level: number;
  created_at: Date;
};

/**
 * A row of the images table
 */
export type Image = {
  id: number;
  filename: string;
  original_filename: string;
  file_path: string;
  file_size: number;
  mime_type: string;
  width: number;
  height: number;
  uploaded_by: number;
  s3_bucket: string | null;
  s3_key: string | null;
  storage_type: "local" | "s3";
  alt_text: string | null;
  created_at: Date;
  updated_at: Date;
};

// `infer` keeps the v3 parameter typing for Dates, booleans, and arrays.
// Notices are only Postgres saying things like "already exists, skipping" during setup.
export const sql = postgres(process.env.DB_CONN ?? "", { infer: true, onnotice: () => {} });

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

export const auditActions = [
  "account_created",
  "role_changed",
  "entity_deleted",
  "image_deleted",
  "version_approved",
  "version_rejected",
] as const;

/**
 * A row of the audit_log table: who did what, and whom it concerns
 */
export type AuditEntry = {
  id: number;
  actor_id: number | null;
  /** The user it concerns, like the author of a reviewed change, who gets notified */
  user_id: number | null;
  action: (typeof auditActions)[number];
  subject: string;
  /** Where the subject can be found, without the language */
  path: string | null;
  details: string;
  created_at: Date;
};

export const recordAudit = async (db: postgres.TransactionSql, entry: {
  actorId: number;
  userId?: number | null;
  action: AuditEntry["action"];
  subject: string;
  path?: string;
  details?: string;
}) => {
  await db`
    INSERT INTO audit_log (actor_id, user_id, action, subject, path, details)
    VALUES (${entry.actorId}, ${entry.userId ?? null}, ${entry.action}, ${entry.subject.slice(0, 255)},
      ${entry.path ?? null}, ${entry.details ?? ""})
  `;
};
