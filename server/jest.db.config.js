// The tests that use a real database (*.db.test.ts): sign up, sign in, the
// shelf's routes, deleting an account, and the paid search budget. They run
// against manga_tracker_test only (src/tests/db/testDb.ts refuses anything
// else), one file at a time, since they share it.
//   once: npm run db:test:setup   (creates and migrates it)
//   then: npm run test:db
import base from "./jest.config.js";

/** @type {import('jest').Config} */
export default {
  ...base,
  testMatch: ["**/*.db.test.ts"],
  testPathIgnorePatterns: ["/node_modules/", "/dist/"],
  maxWorkers: 1,
};
