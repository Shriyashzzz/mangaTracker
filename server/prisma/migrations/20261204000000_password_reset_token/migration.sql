-- A password reset's token and when it stops working, on the account it's for
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "token" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "token_expiry" BIGINT;
