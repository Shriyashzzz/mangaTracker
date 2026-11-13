-- When the reader last changed a series, for the shelf's "Last updated"
-- order. Adds one column to manga; nothing else changes. Every series
-- already there gets the same time (now), so until one is changed they sort
-- by when they were added.
ALTER TABLE "manga" ADD COLUMN "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP;
