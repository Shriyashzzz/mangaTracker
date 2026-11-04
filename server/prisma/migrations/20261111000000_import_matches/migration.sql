-- What imported book titles are on AniList, shared by everyone's imports
-- (util/shelf/sharedMatches.ts). A new table: nothing existing changes.
CREATE TABLE "import_matches" (
    "key" CHAR(64) NOT NULL,
    "anilist_id" INTEGER NOT NULL,
    "mal_id" INTEGER,
    "name" VARCHAR(300) NOT NULL,
    "cover" TEXT,
    "checked_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "import_matches_pkey" PRIMARY KEY ("key")
);
