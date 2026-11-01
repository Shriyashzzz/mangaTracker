-- The newest release a reader has said "Seen it" to, per kind. Anything newer
-- shows up on the New tab again.
ALTER TABLE "manga" ADD COLUMN "seen_volume" DOUBLE PRECISION;
ALTER TABLE "manga" ADD COLUMN "seen_chapter" DOUBLE PRECISION;
ALTER TABLE "manga" ADD COLUMN "seen_japan_volume" DOUBLE PRECISION;
