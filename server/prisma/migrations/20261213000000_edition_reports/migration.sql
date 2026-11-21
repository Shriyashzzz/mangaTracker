-- Readers reporting an omnibus or deluxe book no catalog lists, and the
-- owner's say on each: a book counts once three readers report it, or once
-- it's approved; a rejected one never does (util/shelf/editionReports.ts)
CREATE TABLE IF NOT EXISTS "edition_reports" (
  "id" SERIAL PRIMARY KEY,
  "user_id" INTEGER NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "series" VARCHAR(200) NOT NULL,
  "name" VARCHAR(300) NOT NULL,
  "edition" VARCHAR(20) NOT NULL,
  "number" INTEGER NOT NULL,
  "volumes" INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[],
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "edition_reports_user_id_series_edition_number_key"
  ON "edition_reports"("user_id", "series", "edition", "number");
CREATE INDEX IF NOT EXISTS "edition_reports_series_idx" ON "edition_reports"("series");

CREATE TABLE IF NOT EXISTS "edition_decisions" (
  "series" VARCHAR(200) NOT NULL,
  "edition" VARCHAR(20) NOT NULL,
  "number" INTEGER NOT NULL,
  "status" VARCHAR(10) NOT NULL,
  "volumes" INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[],
  "decided_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("series", "edition", "number")
);
