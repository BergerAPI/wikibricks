import type { Queryable } from "@wikibricks/cms-postgres";

// What moderators, admins and new accounts did, for the admin page and the notifications of
// the users it concerns. The subject is kept as text, so entries stay readable after what
// they are about has been deleted.
export default (sql: Queryable) => sql`
  CREATE TABLE audit_log (
    id SERIAL PRIMARY KEY,
    actor_id INT REFERENCES users(id) ON DELETE SET NULL,
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    action VARCHAR(64) NOT NULL,
    subject VARCHAR(255) NOT NULL,
    path VARCHAR(255),
    details TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX idx_audit_action ON audit_log(action, id);
  CREATE INDEX idx_audit_created ON audit_log(created_at);
  CREATE INDEX idx_audit_user ON audit_log(user_id, created_at);
`.simple();
