-- MangaUpdates' rating, the backup when a series has no MyAnimeList score
-- and no AniList average (prices/scores.ts)
ALTER TABLE "series_scores" ADD COLUMN "mu_score" INTEGER;
ALTER TABLE "series_scores" ADD COLUMN "mu_raters" INTEGER;
