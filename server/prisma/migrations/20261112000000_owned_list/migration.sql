-- The exact volumes someone owns, when it isn't a run from 1 (util/shelf/
-- ownedList.ts). Empty for everyone to start, which means "1 to volumes_owned",
-- exactly what volumes_owned meant before. Nothing existing changes.
ALTER TABLE "manga" ADD COLUMN "owned_list" DOUBLE PRECISION[] DEFAULT ARRAY[]::DOUBLE PRECISION[];
