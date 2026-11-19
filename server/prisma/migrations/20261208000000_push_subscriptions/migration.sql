-- Alerts on a reader's phone (src/push/): each device that switched them on,
-- by the address its browser's push service gave it, with the keys to
-- encrypt for it. One address is one device; signing out takes it away
CREATE TABLE IF NOT EXISTS "push_subscriptions" (
  "id" SERIAL PRIMARY KEY,
  "user_id" INTEGER NOT NULL,
  "endpoint" VARCHAR(1000) NOT NULL,
  "p256dh" VARCHAR(200) NOT NULL,
  "auth" VARCHAR(100) NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "push_subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "push_subscriptions_endpoint_key" ON "push_subscriptions"("endpoint");
CREATE INDEX IF NOT EXISTS "push_subscriptions_user_id_idx" ON "push_subscriptions"("user_id");
