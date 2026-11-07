/**
 * Runs a local Postgres for development, backed by PGlite and filled with sample data.
 *
 *   npm run db            keeps the data in .pglite between runs
 *   npm run db -- --reset starts over with fresh sample data
 *
 * Then start the app with DB_CONN set to the printed connection string.
 */
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import bcrypt from "bcryptjs";
import { rm } from "node:fs/promises";
import { createServer } from "node:net";
import { join } from "node:path";

const port = Number(process.env.PGLITE_PORT ?? 5433);
const dataDir = join(import.meta.dirname, "../.pglite");
// PGlite is a single Postgres session shared by all connections, so the app gets just one
const connection = `postgres://postgres:postgres@127.0.0.1:${port}/postgres?max=1`;

// Checked first, so --reset never deletes the data of an instance that is still running
const portIsFree = await new Promise<boolean>((resolve) => {
  const probe = createServer()
    .once("error", () => resolve(false))
    .listen(port, "127.0.0.1", () => probe.close(() => resolve(true)));
});
if (!portIsFree) {
  console.error(`Port ${port} is in use. Is npm run db already running?`);
  process.exit(1);
}

if (process.argv.includes("--reset")) await rm(dataDir, { recursive: true, force: true });

const db = new PGlite(dataDir);
const server = new PGLiteSocketServer({ db, port, maxConnections: 20 });
await server.start();

// The app modules connect on import, so they are loaded once the server is up
process.env.DB_CONN = connection;
const { sql } = await import("../src/database");
const { initDatabase } = await import("../src/schema");
const { entityDefinitions } = await import("../src/entity-types");
type EntityType = keyof typeof entityDefinitions;

await initDatabase();

const [{ count }] = await sql<{ count: string }[]>`SELECT COUNT(*) AS count FROM users`;
if (count === "0") await seed();

console.log(`
Local database running on ${connection}
Start the app with:  DB_CONN=${connection} npm run dev
Users (password "password"): admin, moderator, alice
Press Ctrl+C to stop.`);

process.on("SIGINT", async () => {
  await sql.end();
  await server.stop();
  await db.close();
  process.exit(0);
});

async function seed() {
  const password = await bcrypt.hash("password", 12);
  const users = await sql<{ id: number; username: string }[]>`
    INSERT INTO users ${sql([
      { username: "admin", password, permission_level: 9 },
      { username: "moderator", password, permission_level: 5 },
      { username: "alice", password, permission_level: 0 },
    ])}
    RETURNING id, username
  `;
  const user = Object.fromEntries(users.map((it) => [it.username, it.id]));

  // Creates an entity whose first version is approved, unless it is a pending proposal
  const addEntity = async (
    type: EntityType,
    name: string,
    description: string,
    fields: Record<string, string | number> = {},
    { author = user.admin, pending = false } = {},
  ) => {
    const [entity] = await sql<{ id: number }[]>`
      INSERT INTO entities (name, type) VALUES (${name}, ${type}) RETURNING id
    `;
    const [version] = await sql<{ id: number }[]>`
      INSERT INTO entity_versions ${sql({
        entity_id: entity.id,
        version_number: 1,
        created_by: author,
        description,
        change_message: "Created",
        review_status: pending ? "pending" : "approved",
        reviewed_by: pending ? null : user.moderator,
        reviewed_at: pending ? null : new Date(),
      })}
      RETURNING id
    `;

    const { table } = entityDefinitions[type];
    if (table) await sql`INSERT INTO ${sql(table)} ${sql({ version_id: version.id, ...fields })}`;
    if (!pending) await sql`UPDATE entities SET head_version_id = ${version.id} WHERE id = ${entity.id}`;

    return { entityId: entity.id, versionId: version.id };
  };

  const lego = await addEntity("brand", "LEGO", "Danish toy company, founded in 1932.", {
    country: "Denmark",
    website: "lego.com",
  });
  const cobi = await addEntity("brand", "Cobi", "Polish maker of construction blocks.", {
    country: "Poland",
    website: "cobi.eu",
  });

  const farm = await addEntity("set", "Farm House", "A small farm with animals and a tractor.", {
    pieces: 512,
    size: "M",
    theme: "lego-nature-farm",
    issued: "2019",
    brand_id: lego.entityId,
  });
  await addEntity("set", "Millennium Falcon", "The largest Star Wars set for a long time.", {
    pieces: 7541,
    size: "XL",
    theme: "lego-licensed-star-wars",
    issued: "10.2017",
    brand_id: lego.entityId,
  });
  await addEntity("set", "Hogwarts Castle", "The castle with the Great Hall and towers.", {
    pieces: 6020,
    size: "XL",
    theme: "lego-licensed-harry-potter",
    issued: "01.09.2018",
    brand_id: lego.entityId,
  });
  await addEntity("set", "City Bus", "A bus with a driver and passengers.", {
    pieces: 280,
    size: "S",
    theme: "lego-architecture-city-vehicles",
    issued: "2021",
    brand_id: cobi.entityId,
  });
  await addEntity("wiki", "Sorting Bricks", "Sort by color first, then by shape.");

  // Something for the moderators to review
  await addEntity(
    "set",
    "Ninjago City",
    "A tall city with many floors.",
    { pieces: 4867, size: "XL", theme: "lego-series-ninjago", issued: "2017", brand_id: lego.entityId },
    { author: user.alice, pending: true },
  );

  const [proposal] = await sql<{ id: number }[]>`
    INSERT INTO entity_versions ${sql({
      entity_id: farm.entityId,
      version_number: 2,
      created_by: user.alice,
      previous_version: farm.versionId,
      description: "A small farm with animals, a tractor and a barn.",
      change_message: "Mention the barn and fix the piece count",
      review_status: "pending",
    })}
    RETURNING id
  `;
  await sql`
    INSERT INTO sets (version_id, pieces, size, theme, issued, brand_id)
    SELECT ${proposal.id}, 520, size, theme, issued, brand_id FROM sets WHERE version_id = ${farm.versionId}
  `;

  console.log("Added sample data");
}
