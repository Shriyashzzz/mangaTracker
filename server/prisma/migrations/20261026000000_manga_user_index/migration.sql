-- shelves are always loaded by owner
CREATE INDEX IF NOT EXISTS "manga_user_id_idx" ON "manga"("user_id");
