import { Client } from "pg";

// adds display preferences to existing users. Safe to run again
const SQL = `
ALTER TABLE users ADD COLUMN IF NOT EXISTS prefs JSONB NOT NULL DEFAULT '{}';
`;

async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });
  try {
    await client.connect();
    await client.query(SQL);
    console.log("users.prefs is ready");
  } finally {
    await client.end();
  }
}

main();
