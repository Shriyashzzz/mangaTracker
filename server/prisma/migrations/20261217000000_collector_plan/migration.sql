-- The Collector tier (src/plan/): each account's plan, when a paid one
-- runs out, and how many barcodes it has scanned.
ALTER TABLE "users"
  ADD COLUMN "plan" VARCHAR(12) NOT NULL DEFAULT 'free',
  ADD COLUMN "plan_until" TIMESTAMPTZ(6),
  ADD COLUMN "scans_used" INTEGER NOT NULL DEFAULT 0;

-- Every account that exists today is an early member: nothing is ever
-- limited for it. Only accounts made from now on start as "free".
UPDATE "users" SET "plan" = 'early';
