// A series' public score: the average of the stars readers gave the whole
// series on their shelves (manga.rating), one rating a reader. It's shown
// as a small badge on the series' cover under Prices, and only once enough
// readers have rated it (reviewRules.ts ENOUGH_RATINGS). Anonymous: only
// the average ever leaves here, never who gave what.
//
// A shelf entry belongs to the series whose address its name makes
// (slugify of the name prices know it by), the same rule a volume's reviews
// follow. Volumes' own ratings are separate (reviews.ts).
import { prisma } from "../config/prisma.js";
import { priceName } from "../prices/lightNovel.js";
import { slugify } from "../prices/stores/match.js";
import { ratingSummary } from "./reviewRules.js";

type RatedEntry = {
  userId: number | null;
  name: string;
  lightNovel: boolean;
  rating: number | null;
};

// Every series with a score, by its slug. A reader with the same series on
// their shelf twice counts once, by the higher rating
export function scoresFrom(entries: RatedEntry[]): Map<string, number> {
  // slug -> reader -> their rating
  const bySeries = new Map<string, Map<number, number>>();
  for (const entry of entries) {
    const slug = slugify(priceName(entry));
    if (!slug || !entry.rating || entry.userId === null) continue;
    const readers = bySeries.get(slug) ?? new Map<number, number>();
    readers.set(
      entry.userId,
      Math.max(readers.get(entry.userId) ?? 0, entry.rating),
    );
    bySeries.set(slug, readers);
  }
  const scores = new Map<string, number>();
  for (const [slug, readers] of bySeries) {
    const { average } = ratingSummary([...readers.values()]);
    if (average !== null) scores.set(slug, average);
  }
  return scores;
}

// worked out from every rated shelf entry, so it's kept for a while: a
// score moves slowly, and the price pages ask for it on every visit
const KEEP_MS = 10 * 60 * 1000;
let kept: { at: number; scores: Map<string, number> } | null = null;

export async function seriesScores(now = Date.now()) {
  if (kept && now - kept.at < KEEP_MS) return kept.scores;
  const entries = await prisma.manga.findMany({
    where: { rating: { gt: 0 } },
    select: { userId: true, name: true, lightNovel: true, rating: true },
  });
  kept = { at: now, scores: scoresFrom(entries) };
  return kept.scores;
}

// one series' score; null until enough readers have rated it
export const seriesScore = async (seriesSlug: string) =>
  (await seriesScores()).get(seriesSlug) ?? null;
