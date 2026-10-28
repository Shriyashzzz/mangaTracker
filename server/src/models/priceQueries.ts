// Everything the price checker stores: books (volumes), the prices we've
// fetched for them, when each was last checked, cached edition covers, and
// the monthly allowance of paid APIs.
//
// Simple reads and writes use Prisma's query builder. The statistics need
// window functions and DISTINCT ON, which Prisma can't express, so those are
// raw SQL ($queryRaw tagged templates: values are always sent as parameters,
// never pasted into the SQL).
import { prisma } from "../config/prisma.js";
import type { Book } from "../../generated/prisma/client.js";
import type { Offer } from "../prices/types.js";

export type { Book };

// a book as the catalog hands it to us, before it's stored
export type NewBook = Pick<
  Book,
  "isbn13" | "title" | "authors" | "publisher" | "coverUrl" | "year"
>;

export type StoredOffer = Offer & { fetchedAt: Date };

// what kind of copy a price is for, in the history: new print, used and
// marketplace copies together, and ebooks
export type PriceKind = "new" | "marketplace" | "ebook";

// one kind's history: every in-stock price ever stored for it
export type KindHistory = {
  kind: PriceKind;
  listings: number;
  lowCents: number;
  lowAt: Date;
  lowStore: string;
  highCents: number;
  highAt: Date;
  highStore: string;
  medianCents: number;
};

export type PriceHistory = {
  checks: number;
  since: Date | null;
  lastSeen: Date | null;
  kinds: KindHistory[];
};

export const getBook = (isbn13: string) =>
  prisma.book.findUnique({ where: { isbn13 } });

// only the columns books has: catalog lookups carry extras (volume, ...)
// that Prisma would reject as unknown arguments
export async function upsertBook({
  isbn13,
  title,
  authors,
  publisher,
  coverUrl,
  year,
}: NewBook) {
  const fields = { title, authors, publisher, coverUrl, year };
  await prisma.book.upsert({
    where: { isbn13 },
    create: { isbn13, ...fields },
    update: { ...fields, updatedAt: new Date() },
  });
}

export const getLastCheck = (isbn13: string) =>
  prisma.priceCheck.findUnique({ where: { isbn13 } });

// records one round of fetching: the check itself plus every offer found.
// The check and its samples get the very same timestamp, which is how
// getLatestOffers and getKnownPrices find "the offers of the latest check"
export async function saveCheck(
  isbn13: string,
  sources: string[],
  offers: Offer[],
) {
  const at = new Date();
  await prisma.$transaction([
    prisma.priceCheck.upsert({
      where: { isbn13 },
      create: { isbn13, sources, checkedAt: at },
      update: { sources, checkedAt: at },
    }),
    prisma.priceSample.createMany({
      data: offers.map((o) => ({ ...o, isbn13, fetchedAt: at })),
    }),
  ]);
}

// the most recent offer from each store + format + condition since `since`,
// cheapest first
export async function getLatestOffers(
  isbn13: string,
  since: Date,
): Promise<StoredOffer[]> {
  const rows = await prisma.$queryRaw<StoredOffer[]>`
    SELECT DISTINCT ON (store, format, condition)
      store, format, condition, price_cents AS "priceCents", currency,
      in_stock AS "inStock", url, fetched_at AS "fetchedAt"
    FROM price_samples
    WHERE isbn13 = ${isbn13} AND fetched_at >= ${since}
    ORDER BY store, format, condition, fetched_at DESC
  `;
  return rows.sort((a, b) => a.priceCents - b.priceCents);
}

// everything we've seen for one volume, worked out from the stored samples
// every time (they're the only record, so the numbers can't drift from
// them). Each kind of copy gets its own lowest, highest and median across
// every in-stock price at every check; mixing them would compare a $5
// ebook with a $25 collector's copy
export async function getPriceHistory(isbn13: string): Promise<PriceHistory> {
  const [kinds, checks] = await Promise.all([
    prisma.$queryRaw<KindHistory[]>`
      WITH s AS (
        SELECT
          CASE WHEN format = 'ebook' THEN 'ebook'
               WHEN condition = 'new' THEN 'new'
               ELSE 'marketplace' END AS kind,
          price_cents AS p, fetched_at AS at, store
        FROM price_samples
        WHERE isbn13 = ${isbn13} AND in_stock
      )
      SELECT
        kind,
        COUNT(*)::int AS "listings",
        (ARRAY_AGG(p ORDER BY p ASC, at ASC))[1]::int AS "lowCents",
        (ARRAY_AGG(at ORDER BY p ASC, at ASC))[1] AS "lowAt",
        (ARRAY_AGG(store ORDER BY p ASC, at ASC))[1] AS "lowStore",
        (ARRAY_AGG(p ORDER BY p DESC, at ASC))[1]::int AS "highCents",
        (ARRAY_AGG(at ORDER BY p DESC, at ASC))[1] AS "highAt",
        (ARRAY_AGG(store ORDER BY p DESC, at ASC))[1] AS "highStore",
        ROUND(percentile_cont(0.5) WITHIN GROUP (ORDER BY p))::int AS "medianCents"
      FROM s
      GROUP BY kind
    `,
    prisma.$queryRaw<Omit<PriceHistory, "kinds">[]>`
      SELECT COUNT(DISTINCT fetched_at)::int AS "checks",
             MIN(fetched_at) AS "since", MAX(fetched_at) AS "lastSeen"
      FROM price_samples
      WHERE isbn13 = ${isbn13} AND in_stock
    `,
  ]);
  const order: PriceKind[] = ["new", "marketplace", "ebook"];
  return {
    ...checks[0]!,
    kinds: kinds.sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind)),
  };
}

// the median of a volume's believable new print prices so far, for judging
// a new check's prices before they're stored. Null with no history yet
export async function getNewPriceMedian(isbn13: string): Promise<number | null> {
  const rows = await prisma.$queryRaw<{ median: number | null }[]>`
    SELECT ROUND(percentile_cont(0.5) WITHIN GROUP (ORDER BY price_cents))::int AS "median"
    FROM price_samples
    WHERE isbn13 = ${isbn13} AND in_stock AND condition = 'new' AND format = 'print'
  `;
  return rows[0]?.median ?? null;
}

// the cheapest new print price from each volume's latest check, for showing
// prices on series pages and shelves without fetching anything
export async function getKnownPrices(
  isbns: string[],
): Promise<Map<string, { priceCents: number; checkedAt: Date }>> {
  if (!isbns.length) return new Map();
  const rows = await prisma.$queryRaw<
    { isbn13: string; priceCents: number; checkedAt: Date }[]
  >`
    SELECT pc.isbn13, MIN(ps.price_cents)::int AS "priceCents",
           pc.checked_at AS "checkedAt"
    FROM price_checks pc
    JOIN price_samples ps
      ON ps.isbn13 = pc.isbn13 AND ps.fetched_at = pc.checked_at
     AND ps.condition = 'new' AND ps.format = 'print'
    WHERE pc.isbn13 = ANY(${isbns}::text[])
    GROUP BY pc.isbn13, pc.checked_at
  `;
  return new Map(rows.map((r) => [r.isbn13.trim(), r]));
}

export type RecentPrice = {
  isbn13: string;
  title: string;
  coverUrl: string | null;
  priceCents: number;
  fetchedAt: Date;
  avgCents: number;
  samples: number;
};

// recently checked volumes with their latest best price and their average,
// so the price home page can show deals and recent checks for free
export async function getRecentBestPrices(limit = 40): Promise<RecentPrice[]> {
  return prisma.$queryRaw<RecentPrice[]>`
    WITH best AS (
      SELECT isbn13, fetched_at, MIN(price_cents) AS p
      FROM price_samples
      WHERE condition = 'new' AND format = 'print'
      GROUP BY isbn13, fetched_at
    ),
    latest AS (
      SELECT DISTINCT ON (isbn13) isbn13, fetched_at, p
      FROM best ORDER BY isbn13, fetched_at DESC
    ),
    averages AS (
      SELECT isbn13, AVG(p) AS avg_p, COUNT(*)::int AS n FROM best GROUP BY isbn13
    )
    SELECT b.isbn13, b.title, b.cover_url AS "coverUrl", l.p::int AS "priceCents",
           l.fetched_at AS "fetchedAt", ROUND(a.avg_p)::int AS "avgCents",
           a.n AS "samples"
    FROM latest l
    JOIN averages a USING (isbn13)
    JOIN books b USING (isbn13)
    -- only US English editions on the price home page
    WHERE l.isbn13 ~ '^(9780|9781|9798)'
      AND b.title !~ '[぀-ヿ一-鿿]'
      -- numbered volumes only: keeps other books that share a name out
      AND b.title ~* 'vol(ume)?[.]?[[:space:]]*[0-9]'
    ORDER BY l.fetched_at DESC
    LIMIT ${limit}
  `;
}

// takes one call from this month's allowance; false once it's used up.
// A single statement, so two requests at once can't both take the last one
export async function claimApiCall(provider: string, limit: number) {
  const changed = await prisma.$executeRaw`
    INSERT INTO api_usage (provider, month, calls)
    VALUES (${provider}, date_trunc('month', now())::date, 1)
    ON CONFLICT (provider, month) DO UPDATE
      SET calls = api_usage.calls + 1
      WHERE api_usage.calls < ${limit}
  `;
  return changed === 1;
}

const MONTH_MS = 30 * 24 * 60 * 60 * 1000;

// known edition covers; a "has none" answer only counts for a month
export const getCoverIds = (isbns: string[]) =>
  prisma.editionCover.findMany({
    where: {
      isbn13: { in: isbns },
      OR: [
        { coverId: { not: null } },
        { checkedAt: { gt: new Date(Date.now() - MONTH_MS) } },
      ],
    },
    select: { isbn13: true, coverId: true },
  });

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
      SELECT b.isbn13, b.title, GREATEST(b.updated_at, pc.checked_at) AS updated
      FROM books b LEFT JOIN price_checks pc USING (isbn13)
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

export default {
  claimApiCall,
  getKnownPrices,
  getRecentBestPrices,
  getBook,
  upsertBook,
  getLastCheck,
  saveCheck,
  getLatestOffers,
  getPriceHistory,
  getNewPriceMedian,
  getCoverIds,
  saveCoverIds,
  getSitemapEntries,
  getBookTitles,
};
