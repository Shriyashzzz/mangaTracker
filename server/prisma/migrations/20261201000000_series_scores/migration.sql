-- A series' scores from outside AniList's own average: MyAnimeList's score
-- (shown first), and AniList's plain mean for a series too little read to
-- have an average. One row per AniList series, filled in the background
-- (collector/scoreFiller.ts) and read by prices/scores.ts.
CREATE TABLE "series_scores" (
    "anilist_id" INTEGER NOT NULL,
    "mal_id" INTEGER,
    "mal_score" INTEGER,
    "mal_raters" INTEGER,
    "mean_score" INTEGER,
    "checked_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "series_scores_pkey" PRIMARY KEY ("anilist_id")
);
