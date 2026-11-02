-- The latest chapter last found for a series, so progress can show without
-- waiting on a new lookup. Existing rows start blank and fill in as they're checked.
ALTER TABLE "manga" ADD COLUMN "latest_chapter" DOUBLE PRECISION;
