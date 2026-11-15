// Edition covers that were looked up, and what the sitemap lists. Part of
// the price queries (priceQueries.ts lists the parts).
import { prisma } from "../config/prisma.js";

const DAY_MS = 24 * 60 * 60 * 1000;
// When Open Library is asked again about an edition it had no cover for.
// One with no cover at all comes first: it shows a drawn stand-in. One
// showing Google Books' cover (often small, 300px wide) waits longer
export const NO_COVER_RECHECK_MS = 20 * DAY_MS;
export const LOW_RES_RECHECK_MS = 30 * DAY_MS;

// known edition covers; a "has none" answer counts for NO_COVER_RECHECK_MS,
// or for LOW_RES_RECHECK_MS while Google's cover stands in
export const getCoverIds = (isbns: string[]) =>
  prisma.editionCover.findMany({
    where: {
      isbn13: { in: isbns },
      OR: [
        { coverId: { not: null } },
        {
          fallbackUrl: null,
          checkedAt: { gt: new Date(Date.now() - NO_COVER_RECHECK_MS) },
        },
        {
          fallbackUrl: { not: null },
          checkedAt: { gt: new Date(Date.now() - LOW_RES_RECHECK_MS) },
        },
      ],
    },
    // (fallbackUrl: the cover Google Books has when Open Library has none)
    select: { isbn13: true, coverId: true, fallbackUrl: true },
  });

// Is this an edition we know has no cover? Its row says Open Library has
// none, and Google Books (the cover route's second place to look,
// sources/covers.ts fallbackCover) hasn't given one either. A book not out
// yet is often on Google only: asking about Open Library alone hid Wistoria
// vol. 14's cover on its own page while Upcoming Releases showed it
export const hasNoCover = (
  row: { coverId: number | null; fallbackUrl: string | null } | undefined,
) => Boolean(row) && row!.coverId === null && !row!.fallbackUrl;

export async function saveCoverIds(found: [string, number | null][]) {
  const checkedAt = new Date();
  await prisma.$transaction(
    found.map(([isbn13, coverId]) =>
      prisma.editionCover.upsert({
        where: { isbn13 },
        create: { isbn13, coverId, checkedAt },
        update: { coverId, checkedAt },
      }),
    ),
  );
}

// everything worth a search engine's time: each volume we know, and each
// series once (several searched names can lead to the same AniList entry)
export async function getSitemapEntries() {
  const [volumes, series] = await Promise.all([
    prisma.$queryRaw<{ isbn13: string; title: string; updated: Date }[]>`
      -- only volumes with prices to show: one without any is near enough the
      -- same page as every other, so search engines' visits go to the pages
      -- worth finding. Only known manga volumes get priced, so no made-up
      -- ISBN gets in. Dated by the newest look that found prices
      SELECT b.isbn13, b.title, GREATEST(b.updated_at, priced.at) AS updated
      FROM books b
      JOIN (
        SELECT sc.isbn13, MAX(sc.checked_at) AS at
        FROM price_source_checks sc
        WHERE EXISTS (
          SELECT 1 FROM price_samples ps
          WHERE ps.isbn13 = sc.isbn13 AND ps.source = sc.source
            AND ps.fetched_at = sc.checked_at
        )
        GROUP BY sc.isbn13
      ) priced USING (isbn13)
      ORDER BY b.isbn13
    `,
    prisma.$queryRaw<{ name: string; fetchedAt: Date }[]>`
      SELECT DISTINCT ON (info->>'anilistId') info->>'name' AS name,
             fetched_at AS "fetchedAt"
      FROM series_info
      WHERE info IS NOT NULL AND info->>'name' IS NOT NULL
      ORDER BY info->>'anilistId', fetched_at DESC
    `,
  ]);
  return { volumes, series };
}

// every volume we've stored, for matching shelf manga to their series
export async function getBookTitles() {
  const rows = await prisma.book.findMany({
    select: { isbn13: true, title: true },
  });
  return rows.map((r) => ({ isbn13: r.isbn13.trim(), title: r.title }));
}
