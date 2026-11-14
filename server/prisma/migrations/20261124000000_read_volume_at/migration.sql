-- When the reader last finished a volume of a series: their read volume went
-- up, or they marked the series finished. A series' page asks what they
-- thought of that volume for a few days after (reviews/reviewRules.ts).
-- Adds one column to manga, empty for every series already there; nothing
-- else changes.
ALTER TABLE "manga" ADD COLUMN "read_volume_at" TIMESTAMPTZ(6);
