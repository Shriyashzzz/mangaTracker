import { Client } from "pg";

// brings an existing database up to date with columns added after it was
// first made. Every statement is safe to run again
const SQL = `
ALTER TABLE users ADD COLUMN IF NOT EXISTS prefs JSONB NOT NULL DEFAULT '{}';
ALTER TABLE manga ADD COLUMN IF NOT EXISTS volumes_owned SMALLINT
  CHECK (volumes_owned > 0);
`;

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  try {
    await client.connect();
    await client.query(SQL);
    console.log("database is up to date");
  } finally {
    await client.end();
  }
}

main();
