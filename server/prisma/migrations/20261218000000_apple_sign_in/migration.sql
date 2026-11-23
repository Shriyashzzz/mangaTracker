-- Signing in with Apple (src/auth/appleSignIn.ts): the Apple account's ID
-- ("sub"), the same for that person in this app for good
ALTER TABLE "users" ADD COLUMN "apple_id" VARCHAR(64);
CREATE UNIQUE INDEX "users_apple_id_key" ON "users"("apple_id");
