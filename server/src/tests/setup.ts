// Settings for tests that don't need a real database. Anything already in
// the environment (a real DATABASE_URL for integration runs) wins
process.env.DATABASE_URL ??= "postgresql://localhost:5432/manga_tracker_test";
process.env.SECRET ??= "test-secret";
process.env.CLIENT_URL ??= "http://localhost:5173";
