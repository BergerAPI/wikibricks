import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import postgres from "postgres";

/**
 * An empty in-memory Postgres for one test file.
 */
export const startDatabase = async () => {
  const db = new PGlite();
  const server = new PGLiteSocketServer({ db, port: 0, maxConnections: 4 });
  await server.start();

  // PGlite is one session shared by all connections, so the client gets just one
  const sql = postgres(`postgres://postgres:postgres@${server.getServerConn()}/postgres`, {
    max: 1,
    onnotice: () => {},
  });

  const stop = async () => {
    await sql.end();
    await server.stop();
    await db.close();
  };
  return { sql, stop };
};
