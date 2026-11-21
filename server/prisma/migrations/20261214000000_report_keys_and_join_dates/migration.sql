-- When an account was made: readers' reports of missing edition books count
-- only from accounts a week old. Accounts made before this carry today
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Reports and the owner's decisions keyed by the series' compared name alone,
-- without the saved lists' version ("v10:vagabond" -> "vagabond"), so a new
-- list version never leaves them behind
UPDATE "edition_reports" SET "series" = regexp_replace("series", '^v[0-9]+:', '');
UPDATE "edition_decisions" SET "series" = regexp_replace("series", '^v[0-9]+:', '');
