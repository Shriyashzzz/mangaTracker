// The score a series shows (its stars), in one place:
//   1. MyAnimeList's score, the biggest rating base
//   2. AniList's average, which it only gives a series enough people rated
//   3. MangaUpdates' rating, asked only for a series with neither
//   4. AniList's plain mean, for a series too little read to have an average
// The second comes with the series from AniList; the others are saved by
// the background (collector/scoreFiller.ts, series_scores).
import { prisma } from "../config/prisma.js";

export type SavedScore = {
  malScore: number | null;
  muScore: number | null;
  meanScore: number | null;
};

// the score to show, and whether it's only the plain mean of a few raters
// (kept out of the top of "Top rated")
export function bestScore(
  anilistAverage: number | null,
  saved: SavedScore | undefined,
): { score: number | null; fewRaters: boolean } {
  const trusted = saved?.malScore ?? anilistAverage ?? saved?.muScore ?? null;
  if (trusted != null) return { score: trusted, fewRaters: false };
  const mean = saved?.meanScore ?? null;
  return { score: mean, fewRaters: mean != null };
}

// every saved score by AniList id: a few hundred rows, read again when ten
// minutes old (one read at a time)
const FRESH_MS = 10 * 60_000;
let saved = new Map<number, SavedScore>();
let loadedAt = 0;
let loading: Promise<void> | null = null;

async function load() {
  const rows = await prisma.seriesScore.findMany({
    select: { anilistId: true, malScore: true, muScore: true, meanScore: true },
  });
  saved = new Map(rows.map(({ anilistId, ...scores }) => [anilistId, scores]));
  loadedAt = Date.now();
}

// never fails: without the saved scores a series shows AniList's own
export async function savedScores() {
  if (Date.now() - loadedAt >= FRESH_MS) {
    loading ??= load()
      .catch((e: Error) =>
        console.error("Saved scores couldn't be read:", e.message),
      )
      .finally(() => (loading = null));
    await loading;
  }
  return saved;
}

// after the background saves new ones
export const forgetSavedScores = () => (loadedAt = 0);

// anything with an AniList score, given the score it shows instead
export async function withShownScore<
  T extends { anilistId?: number | null; score: number | null },
>(items: T[]): Promise<(T & { fewRaters?: true })[]> {
  const scores = await savedScores();
  return items.map((item) => {
    const { score, fewRaters } = bestScore(
      item.score,
      item.anilistId == null ? undefined : scores.get(item.anilistId),
    );
    return {
      ...item,
      score,
      ...(fewRaters ? { fewRaters: true as const } : {}),
    };
  });
}
