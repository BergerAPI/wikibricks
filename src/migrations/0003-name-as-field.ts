import type { Queryable } from "@wikibricks/cms-postgres";

// The name used to be a column of entities, unique across all types. It became a regular
// field, unique within each type, so every version gets the name of its entity.
export default async (sql: Queryable) => {
  for (const table of ["sets", "brands", "wikis"]) {
    await sql`ALTER TABLE ${sql(table)} ADD COLUMN IF NOT EXISTS name VARCHAR(255)`;
    await sql`
      UPDATE ${sql(table)} t SET name = e.name
      FROM entity_versions v JOIN entities e ON e.id = v.entity_id
      WHERE v.id = t.version_id
    `;
  }

  // Also drops the unique constraint and the index that included the name
  await sql`ALTER TABLE entities DROP COLUMN name`;
};
