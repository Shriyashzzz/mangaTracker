-- A series a reader picked by hand for a title in their import: theirs on
-- every later import, and shared with everyone once three readers agree
-- (util/shelf/importPicks.ts). Deleted with the account.
CREATE TABLE "import_picks" (
    "user_id" INTEGER NOT NULL,
    "key" CHAR(64) NOT NULL,
    "anilist_id" INTEGER NOT NULL,
    "mal_id" INTEGER,
    "name" VARCHAR(300) NOT NULL,
    "cover" TEXT,
    "picked_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "import_picks_pkey" PRIMARY KEY ("user_id","key")
);

CREATE INDEX "import_picks_key_anilist_id_idx" ON "import_picks"("key", "anilist_id");

ALTER TABLE "import_picks" ADD CONSTRAINT "import_picks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
