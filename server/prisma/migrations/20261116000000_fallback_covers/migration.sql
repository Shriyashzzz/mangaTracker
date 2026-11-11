-- a cover from Google Books for an edition Open Library has none for
-- (prices/sources/covers.ts fallbackCover). Null url with a checked time:
-- Google had none either, asked again after 30 days
ALTER TABLE "edition_covers" ADD COLUMN "fallback_url" TEXT;
ALTER TABLE "edition_covers" ADD COLUMN "fallback_checked_at" TIMESTAMPTZ(6);
