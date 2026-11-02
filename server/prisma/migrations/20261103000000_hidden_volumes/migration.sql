-- Volumes a reader has hidden one at a time, on top of everything up to
-- seen_volume. Existing rows start with none.
ALTER TABLE "manga" ADD COLUMN "hidden_volumes" DOUBLE PRECISION[] NOT NULL DEFAULT '{}';
