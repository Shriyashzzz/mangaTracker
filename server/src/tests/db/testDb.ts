// For the database tests (*.db.test.ts): a clean slate between tests, and
// closing the database at the end. guard.ts (run first, from
// jest.db.config.js) makes sure it's a database ending in "_test".
import { pool, prisma } from "../../config/prisma.js";

// what the tests write: accounts (their manga and sign-ins go with them) and
// the search counts. Books, prices and the import matches are left alone
export const emptyDb = () =>
  prisma.$executeRawUnsafe(
    "TRUNCATE users, session, api_usage, guest_searches RESTART IDENTITY CASCADE",
  );

export const closeDb = async () => {
  await prisma.$disconnect();
  await pool.end();
};

export { prisma };
