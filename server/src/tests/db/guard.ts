// Runs before every database test file (jest.db.config.js setupFiles), so a
// new *.db.test.ts can't forget it. The database tests empty the tables they
// write to, so they refuse any database whose name doesn't end in "_test".
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
    `The database tests empty tables, so they only run on a database ending in "_test", not "${name}". Run npm run db:test:setup once.`,
  );
}
