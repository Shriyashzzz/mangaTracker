/** @type {import('jest').Config} */
export default {
  testEnvironment: "node",
  extensionsToTreatAsEsm: [".ts"],
  setupFiles: ["<rootDir>/src/tests/setup.ts"],
  testMatch: ["**/*.test.ts"],
  // *.db.test.ts need a real database: `npm run test:db` (jest.db.config.js)
  testPathIgnorePatterns: ["/node_modules/", "/dist/", "\\.db\\.test\\.ts$"],
  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1",
  },
  transform: {
    "^.+\\.tsx?$": [
      "@swc/jest",
      {
        jsc: { parser: { syntax: "typescript" }, target: "es2022" },
        module: { type: "es6" }, // @prisma/client v7 is ESM-only
      },
    ],
  },
};
