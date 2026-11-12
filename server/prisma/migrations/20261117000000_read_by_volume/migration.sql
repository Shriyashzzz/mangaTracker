-- reading tracked by the volume instead of the chapter, per series: which way
-- (by_volume), and the last volume read (read_volume). The chapter keeps its
-- own number, so switching back loses nothing. Adds columns only.
ALTER TABLE "manga" ADD COLUMN "by_volume" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "manga" ADD COLUMN "read_volume" SMALLINT;
-- a light novel is read by the volume. Its chapter number stays where it is
UPDATE "manga" SET "by_volume" = true WHERE "light_novel";
