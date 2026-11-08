import type { Queryable } from "@wikibricks/cms-postgres";

// Description and image used to be columns of entity_versions. They became regular fields,
// so they move to the tables of the entity types. Wikis had no fields before and get a table.
export default async (sql: Queryable) => {
  for (const table of ["sets", "brands", "wikis"]) {
    await sql`
      CREATE TABLE IF NOT EXISTS ${sql(table)} (
        version_id INT PRIMARY KEY REFERENCES entity_versions(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    await sql`
      ALTER TABLE ${sql(table)}
      ADD COLUMN IF NOT EXISTS description TEXT,
      ADD COLUMN IF NOT EXISTS image_id INTEGER REFERENCES images(id) ON DELETE SET NULL
    `;
  }

  await sql`
    INSERT INTO wikis (version_id)
    SELECT v.id FROM entity_versions v JOIN entities e ON v.entity_id = e.id
    WHERE e.type = 'wiki'
    ON CONFLICT DO NOTHING
  `;

  for (const table of ["sets", "brands", "wikis"]) {
    await sql`
      UPDATE ${sql(table)} t SET description = v.description, image_id = v.image_id
      FROM entity_versions v WHERE v.id = t.version_id
    `;
  }

  await sql`ALTER TABLE entity_versions DROP COLUMN description, DROP COLUMN image_id`;
};
