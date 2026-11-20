-- Signing in with Google: the account a Google sign-in belongs to is found by
-- the Google account's ID (its "sub", never its email or name, which aren't
-- kept). An account made with Google has no password until its reader sets
-- one in Settings, so a password can be missing
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "google_id" VARCHAR(64);
CREATE UNIQUE INDEX IF NOT EXISTS "users_google_id_key" ON "users"("google_id");
ALTER TABLE "users" ALTER COLUMN "password" DROP NOT NULL;
