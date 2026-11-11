/**
 * Starts everything for development: a local database, the server and the client build.
 * Server and client restart on changes.
 *
 *   npm run dev              uses the local database, unless .env sets DB_CONN
 *   npm run dev -- --reset   starts over with fresh sample data
 *   npm run db               only runs the local database, e.g. for a production build
 */
import "dotenv/config";
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { startLocalDatabase } from "./local-db";

const flags = process.argv.slice(2);
const database = process.env.DB_CONN ? undefined : await startLocalDatabase({ reset: flags.includes("--reset") });

if (database) {
  console.log(`Local database running on ${database.connection}`);
  console.log(`Users (password "password"): admin, moderator, alice`);
}

const children: ChildProcess[] = [];
const shutDown = async (code = 0) => {
  for (const child of children) child.kill();
  await database?.stop();
  process.exit(code);
};
process.on("SIGINT", () => shutDown());
process.on("SIGTERM", () => shutDown());

if (!flags.includes("--db-only")) {
  // The server needs the client's manifest before its first request
  spawnSync("npx", ["vite", "build"], { stdio: "inherit" });

  for (const script of ["dev:server", "dev:client"]) {
    const child = spawn("npm", ["run", script], { stdio: "inherit" });
    // Without one of them the others are of no use
    child.on("exit", (code) => shutDown(code ?? 1));
    children.push(child);
  }
}
