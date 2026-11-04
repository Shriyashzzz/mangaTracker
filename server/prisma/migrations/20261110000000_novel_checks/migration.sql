-- Which manga have a light novel AniList doesn't list, found in the background
-- as series come up in searches (prices/novelFinder.ts). A new table: nothing
-- existing changes.
CREATE TABLE "novel_checks" (
    "key" VARCHAR(200) NOT NULL,
    "name" VARCHAR(200),
    "volumes" INTEGER NOT NULL DEFAULT 0,
    "checked_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "novel_checks_pkey" PRIMARY KEY ("key")
);
