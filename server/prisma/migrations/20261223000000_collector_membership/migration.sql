-- The Collector member card (src/plan/membership.ts): when the account
-- first became a Collector (set once, never moved), which product it pays
-- for, and whether Apple will renew it
ALTER TABLE "users"
  ADD COLUMN "collector_since" TIMESTAMPTZ(6),
  ADD COLUMN "apple_product" VARCHAR(64),
  ADD COLUMN "plan_renews" BOOLEAN;
