-- When a reader was last asked, out loud, what they thought of a volume
-- they'd just finished. The question comes rarely (config
-- RATE_ASK_EVERY_DAYS), across all their series, so the time is kept on the
-- account. Adds one column to users, empty for everyone; nothing else
-- changes.
ALTER TABLE "users" ADD COLUMN "rate_asked_at" TIMESTAMPTZ(6);
