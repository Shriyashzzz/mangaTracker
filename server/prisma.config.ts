import "dotenv/config";
import { defineConfig } from "prisma/config";

const url = process.env.DATABASE_URL ?? "";

// ---------- guard against wiping a real database ----------
// `migrate reset` drops every table, and `migrate dev` / `db push` can offer
// to. On 2026-10-27 a reset ran against production because server/.env held
// the production URL, and there was no backup. These commands now refuse to
// run unless the database is on this machine. To really do it on a remote
// database (you almost never should), set ALLOW_REMOTE_DESTRUCTIVE=yes.
const args = process.argv.slice(2).join(" ");
const destructive = /\bmigrate\s+(reset|dev)\b|\bdb\s+push\b/.test(args);

const host = (() => {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
})();
const isLocal = ["localhost", "127.0.0.1", "::1", "[::1]", ""].includes(host);

if (destructive && !isLocal && process.env.ALLOW_REMOTE_DESTRUCTIVE !== "yes") {
  throw new Error(
    `Refusing to run "prisma ${args}" against ${host}: it can delete every ` +
      `table. Point DATABASE_URL at your local database. For a deployed ` +
      `database use "npm run db:deploy", which never drops anything.`,
  );
}

// `prisma generate` doesn't connect anywhere, so a missing DATABASE_URL is
// only a problem for migrate/studio; those will say so themselves
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url,
  },
});
