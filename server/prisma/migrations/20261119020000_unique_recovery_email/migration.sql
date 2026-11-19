-- A recovery email belongs to one account. Emails are saved in lowercase
-- from now on, so the ones already saved are lowercased first; then each
-- address is kept to one account.
-- If two accounts already share an address this stops, changing nothing:
-- decide which account keeps it, clear the other, and deploy again.

UPDATE "users"
SET "recovery_email" = lower("recovery_email")
WHERE "recovery_email" IS NOT NULL
  AND "recovery_email" <> lower("recovery_email");

-- CreateIndex
CREATE UNIQUE INDEX "users_recovery_email_key" ON "users"("recovery_email");
