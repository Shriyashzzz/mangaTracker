-- A shelf entry can be a light novel instead of a manga. Everything already on
-- a shelf stays a manga.
ALTER TABLE "manga" ADD COLUMN "light_novel" BOOLEAN NOT NULL DEFAULT false;
