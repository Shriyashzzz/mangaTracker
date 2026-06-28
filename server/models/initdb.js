import { Client } from "pg";

const SQL = `
CREATE TABLE IF NOT EXISTS users( 
  id       INTEGER PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  username VARCHAR(40) NOT NULL UNIQUE, 
  password TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS manga(
  id          INTEGER PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  user_id     INTEGER REFERENCES users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  genre       VARCHAR(100),
  description TEXT,
  image       TEXT,
  status      BOOLEAN DEFAULT FALSE NOT NULL, 
  bookmark    INTEGER,
  rating      SMALLINT CHECK (rating >= 0 AND rating <= 5)
);

CREATE TABLE "session" (
  "sid" varchar NOT NULL COLLATE "default",
  "sess" json NOT NULL,
  "expire" timestamp(6) NOT NULL
)
WITH (OIDS=FALSE);

ALTER TABLE "session" ADD CONSTRAINT "session_pkey" PRIMARY KEY ("sid") NOT DEFERRABLE INITIALLY IMMEDIATE;

CREATE INDEX "IDX_session_expire" ON "session" ("expire");
`;

async function main() {
  console.log("Database Target:", process.env.DATABASE_URL);
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });
  try {
    console.log("seeding database with 25 certified bangers...");
    await client.connect();
    await client.query(SQL);
    console.log(
      "done! your manga library is now stocked and ready to judge you.",
    );
  } catch (e) {
    throw new Error(
      "Failed to seed database, which is ironic because these mangas are about people who never give up",
      { cause: e },
    );
  } finally {
    await client.end();
  }
}

main();
