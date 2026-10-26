import { Client } from "pg";

// tables for the price checker. Safe to run again: everything is IF NOT EXISTS
const SQL = `
CREATE TABLE IF NOT EXISTS books(
  isbn13      CHAR(13) PRIMARY KEY,
  title       TEXT NOT NULL,
  authors     TEXT,
  publisher   TEXT,
  cover_url   TEXT,
  year        SMALLINT,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- every price we ever fetch, so we can show the latest offers and the history
CREATE TABLE IF NOT EXISTS price_samples(
  id          BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  isbn13      CHAR(13) NOT NULL REFERENCES books(isbn13) ON DELETE CASCADE,
  store       VARCHAR(60) NOT NULL,
  format      VARCHAR(20) NOT NULL DEFAULT 'print',
  condition   VARCHAR(20) NOT NULL DEFAULT 'new',
  price_cents INTEGER NOT NULL CHECK (price_cents >= 0),
  currency    CHAR(3) NOT NULL DEFAULT 'USD',
  in_stock    BOOLEAN NOT NULL DEFAULT TRUE,
  url         TEXT,
  fetched_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS price_samples_isbn_time
  ON price_samples (isbn13, fetched_at DESC);

-- AniList series info, cached a week per series
CREATE TABLE IF NOT EXISTS series_info(
  slug        VARCHAR(80) PRIMARY KEY,
  info        JSONB,
  fetched_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- paid APIs with a monthly allowance: how many calls we've made this month
CREATE TABLE IF NOT EXISTS api_usage(
  provider    VARCHAR(40) NOT NULL,
  month       DATE NOT NULL,
  calls       INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (provider, month)
);

-- when each volume was last checked, even if no store had it
CREATE TABLE IF NOT EXISTS price_checks(
  isbn13      CHAR(13) PRIMARY KEY REFERENCES books(isbn13) ON DELETE CASCADE,
  checked_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  sources     TEXT[] NOT NULL DEFAULT '{}'
);

-- the Open Library cover of each US edition, found once and kept. A NULL
-- cover_id means the edition has none; those are looked at again monthly
CREATE TABLE IF NOT EXISTS edition_covers(
  isbn13      CHAR(13) PRIMARY KEY,
  cover_id    INTEGER,
  checked_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
`;

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  try {
    await client.connect();
    await client.query(SQL);
    console.log("price tables ready.");
  } catch (e) {
    throw new Error("Failed to create the price tables", { cause: e });
  } finally {
    await client.end();
  }
}

main();
