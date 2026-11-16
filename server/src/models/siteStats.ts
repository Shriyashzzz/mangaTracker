// The site's own numbers, for the owner's page (/reviews/reported): how
// many readers, shelves, prices and reviews there are, and for those with a
// date, how many came in the last week. Counts only, read from the database
// each time: only the owner asks
import { prisma } from "../config/prisma.js";

const WEEK_MS = 7 * 24 * 60 * 60_000;

export type SiteStats = {
  readers: number;
  // series on readers' shelves, and how many different ones
  shelved: number;
  shelvedSeries: number;
  // every price saved, US and Canada together
  prices: { total: number; week: number };
  // volumes with at least one price, and those priced for the first time
  // this week
  volumesPriced: { total: number; week: number };
  // series the site has saved AniList's info for (the "Did you mean" list)
  seriesKnown: number;
  reviews: { total: number; week: number };
};

const counted = (rows: { n: bigint }[]) => Number(rows[0]?.n ?? 0);

export async function siteStats(now = Date.now()): Promise<SiteStats> {
  const since = new Date(now - WEEK_MS);
  const [
    readers,
    shelved,
    shelvedSeries,
    prices,
    pricesWeek,
    volumesPriced,
    volumesPricedWeek,
    seriesKnown,
    reviews,
    reviewsWeek,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.manga.count(),
    prisma.$queryRaw<{ n: bigint }[]>`
      SELECT COUNT(DISTINCT lower(name)) AS n FROM manga`.then(counted),
    prisma.$queryRaw<{ n: bigint }[]>`
      SELECT (SELECT COUNT(*) FROM price_samples)
           + (SELECT COUNT(*) FROM ca_price_samples) AS n`.then(counted),
    prisma.$queryRaw<{ n: bigint }[]>`
      SELECT (SELECT COUNT(*) FROM price_samples WHERE fetched_at > ${since})
           + (SELECT COUNT(*) FROM ca_price_samples WHERE fetched_at > ${since})
           AS n`.then(counted),
    prisma.$queryRaw<{ n: bigint }[]>`
      SELECT COUNT(*) AS n FROM (
        SELECT isbn13 FROM price_samples
        UNION
        SELECT isbn13 FROM ca_price_samples
      ) priced`.then(counted),
    // a volume's first price, wherever it came from, is this week's
    prisma.$queryRaw<{ n: bigint }[]>`
      SELECT COUNT(*) AS n FROM (
        SELECT isbn13, MIN(fetched_at) AS first FROM (
          SELECT isbn13, fetched_at FROM price_samples
          UNION ALL
          SELECT isbn13, fetched_at FROM ca_price_samples
        ) every_price
        GROUP BY isbn13
      ) firsts
      WHERE first > ${since}`.then(counted),
    prisma.$queryRaw<{ n: bigint }[]>`
      SELECT COUNT(DISTINCT info->>'name') AS n FROM series_info
      WHERE info->>'name' IS NOT NULL`.then(counted),
    prisma.volumeReview.count(),
    prisma.volumeReview.count({ where: { createdAt: { gt: since } } }),
  ]);
  return {
    readers,
    shelved,
    shelvedSeries,
    prices: { total: prices, week: pricesWeek },
    volumesPriced: { total: volumesPriced, week: volumesPricedWeek },
    seriesKnown,
    reviews: { total: reviews, week: reviewsWeek },
  };
}
