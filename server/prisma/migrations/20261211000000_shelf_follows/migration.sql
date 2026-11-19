-- Following another reader's shared shelf (Friends). Sharing it is the
-- owner's yes: a follow only shows while their sharing is on, and either
-- account going takes the follow with it
CREATE TABLE IF NOT EXISTS "shelf_follows" (
  "follower_id" INTEGER NOT NULL,
  "owner_id" INTEGER NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "shelf_follows_pkey" PRIMARY KEY ("follower_id", "owner_id"),
  CONSTRAINT "shelf_follows_follower_id_fkey" FOREIGN KEY ("follower_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "shelf_follows_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "shelf_follows_owner_id_idx" ON "shelf_follows"("owner_id");
