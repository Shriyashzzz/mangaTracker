-- The weekly email (src/digest/): who asked for it, whether their address
-- was confirmed, the code in their confirm and unsubscribe links, and when
-- their last one went out
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "weekly_email" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "email_confirmed" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "email_code" VARCHAR(40);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "digest_sent_at" TIMESTAMPTZ(6);
CREATE UNIQUE INDEX IF NOT EXISTS "users_email_code_key" ON "users"("email_code");

-- What each reader has been emailed about, so nothing is sent twice:
-- "out:812:15" (series 812's vol. 15 is out), "soon:812:16", "drop:<isbn>"
CREATE TABLE IF NOT EXISTS "digest_items" (
  "user_id" INTEGER NOT NULL,
  "item" VARCHAR(80) NOT NULL,
  "sent_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "digest_items_pkey" PRIMARY KEY ("user_id", "item"),
  CONSTRAINT "digest_items_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
