import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { rm } from "node:fs/promises";
import { createServer } from "node:net";
import { join } from "node:path";

const port = Number(process.env.PGLITE_PORT ?? 5433);
const dataDir = process.env.PGLITE_DIR ?? join(import.meta.dirname, "../.pglite");

const isPortFree = () =>
  new Promise<boolean>((resolve) => {
    const probe = createServer()
      .once("error", () => resolve(false))
      .listen(port, "127.0.0.1", () => probe.close(() => resolve(true)));
  });

/**
 * Runs a local Postgres for development, backed by PGlite. The data stays in .pglite
 * between runs, and a new database is filled with sample data.
 *
 * PGLITE_PORT and PGLITE_DIR change the port (5433) and where the data is kept.
 */
export async function startLocalDatabase({ reset = false } = {}) {
  // Checked first, so a reset never deletes the data of an instance that is still running
  if (!(await isPortFree())) throw new Error(`Port ${port} is in use. Is the local database already running?`);
  if (reset) await rm(dataDir, { recursive: true, force: true });

  const db = new PGlite(dataDir);
  const server = new PGLiteSocketServer({ db, port, maxConnections: 20 });
  await server.start();

  // PGlite is a single Postgres session shared by all connections, so the app gets just one
  const connection = `postgres://postgres:postgres@127.0.0.1:${port}/postgres?max=1`;

  // The app modules connect on import, so they are loaded once the server is up
  process.env.DB_CONN = connection;
  const { sql } = await import("../src/database");
  const { cms } = await import("../src/collections");
  await cms.init();

  const [{ count }] = await sql<{ count: string }[]>`SELECT COUNT(*) AS count FROM users`;
  if (count === "0") await (await import("./seed")).seed();

  return {
    connection,
    stop: async () => {
      await sql.end();
      await server.stop();
      await db.close();
    },
  };
}
