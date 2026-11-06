// For the database tests (*.db.test.ts): which database they're on, a clean
// slate between tests, and closing it at the end. They refuse to run on any
// database whose name doesn't end in "_test": TRUNCATE empties every table.
import { pool, prisma } from "../../config/prisma.js";

const url = process.env.DATABASE_URL ?? "";
const name = (() => {
  try {
    return new URL(url).pathname.slice(1);
  } catch {
    return "";
  }
})();
if (!name.endsWith("_test")) {
  throw new Error(
    `The database tests empty every table, so they only run on a database ending in "_test", not "${name}". Run npm run db:test:setup once.`,
  );
}

// everything a test could have written; manga goes with its users
export const emptyDb = () =>
  prisma.$executeRawUnsafe(
    "TRUNCATE users, session, api_usage, guest_searches RESTART IDENTITY CASCADE",
  );

export const closeDb = async () => {
  await prisma.$disconnect();
  await pool.end();
};

export { prisma };
