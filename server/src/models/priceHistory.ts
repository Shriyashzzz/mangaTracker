// What prices have been over time: a volume's history, its usual price, and
// the cheapest copy known now. Part of the price queries (priceQueries.ts
// lists the parts).
import { prisma } from "../config/prisma.js";
import {
  dropUnlikelyNew,
  lowestBelievableNew,
} from "../prices/stores/retailers.js";
import type { Offer } from "../prices/types.js";
import {
  type PriceKind,
  type KindHistory,
  type PriceHistory,
  type CurrentRow,
  currentOf,
  currentRows,
  lookedAt,
  groupBy,
  getUnbelievableSampleIds,
} from "./priceBooks.js";

// everything we've seen for one volume, worked out from the stored samples
// every time (they're the only record, so the numbers can't drift from
// them). Each kind of copy gets its own lowest, highest and median across
// every in-stock price at every check; mixing them would compare a $5
// ebook with a $25 collector's copy
// `median`: the volume's usual new price, if the caller already has it
export async function getPriceHistory(
  isbn13: string,
  median?: number | null,
): Promise<PriceHistory> {
  const ignored = await getUnbelievableSampleIds(isbn13, median);
  const [kinds, checks] = await Promise.all([
    prisma.$queryRaw<KindHistory[]>`
      WITH s AS (
        SELECT
          CASE WHEN format = 'ebook' THEN 'ebook'
               WHEN condition = 'new' THEN 'new'
               ELSE 'marketplace' END AS kind,
          price_cents AS p, fetched_at AS at, store
        FROM price_samples
        -- box sets and omnibuses are other products: not this volume's history
        WHERE isbn13 = ${isbn13} AND in_stock AND format NOT IN ('set', 'omnibus')
          AND id::text <> ALL(${ignored}::text[])
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
      WHERE isbn13 = ${isbn13} AND in_stock AND id::text <> ALL(${ignored}::text[])
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
export async function getNewPriceMedian(
  isbn13: string,
): Promise<number | null> {
  const rows = await prisma.$queryRaw<{ median: number | null }[]>`
    SELECT ROUND(percentile_cont(0.5) WITHIN GROUP (ORDER BY price_cents))::int AS "median"
    FROM price_samples
    WHERE isbn13 = ${isbn13} AND in_stock AND condition = 'new' AND format = 'print'
  `;
  return rows[0]?.median ?? null;
}

// each volume's usual new print price (the median of every one saved), the
// yardstick for a "new" price too far off to believe
async function newMedians(isbns: string[]) {
  const rows = await prisma.$queryRaw<{ isbn13: string; median: number }[]>`
    SELECT isbn13,
           ROUND(percentile_cont(0.5) WITHIN GROUP (ORDER BY price_cents))::int AS median
    FROM price_samples
    WHERE isbn13 = ANY(${isbns}::text[])
      AND in_stock AND condition = 'new' AND format = 'print'
    GROUP BY isbn13
  `;
  return new Map(rows.map((u) => [u.isbn13.trim(), u.median]));
}

// What a volume has gone for: the median of every in-stock print price ever
// recorded for it, used and new apart, so a price never goes stale (a check
// that finds nothing doesn't wipe it, and each look adds to it). The last 12
// months win when there are any: a price from years ago is only the fallback.
// For the shelf tools (collector/); database only
export type RecordedPrice = { used: number | null; new: number | null };
export async function getRecordedMedians(
  isbns: string[],
): Promise<Map<string, RecordedPrice>> {
  if (!isbns.length) return new Map();
  const rows = await prisma.$queryRaw<
    (Offer & { isbn13: string; fetchedAt: Date })[]
  >`
    SELECT isbn13, store, format, condition, price_cents AS "priceCents",
           currency, in_stock AS "inStock", url, fetched_at AS "fetchedAt"
    FROM price_samples
    WHERE isbn13 = ANY(${isbns}::text[]) AND in_stock AND format = 'print'
  `;
  const yearAgo = Date.now() - 365 * 24 * 60 * 60 * 1000;
  const mid = (cents: number[]) => {
    if (!cents.length) return null;
    const sorted = [...cents].sort((a, b) => a - b);
    const m = Math.floor(sorted.length / 2);
    return sorted.length % 2
      ? sorted[m]!
      : Math.round((sorted[m - 1]! + sorted[m]!) / 2);
  };
  const out = new Map<string, RecordedPrice>();
  for (const [isbn, samples] of groupBy(rows, (r) => r.isbn13.trim())) {
    // each check's "new" prices held to the believable-price rule first, as
    // the price pages hold them: one collector's edition or mislabelled row
    // mustn't move what a volume goes for
    const usual = mid(
      samples.filter((s) => s.condition === "new").map((s) => s.priceCents),
    );
    const kept = [
      ...groupBy(samples, (s) => String(s.fetchedAt.getTime())).values(),
    ].flatMap((check) => dropUnlikelyNew(check, usual));
    const pick = (cond: (s: (typeof kept)[number]) => boolean) => {
      const all = kept.filter(cond);
      const recent = all.filter((s) => s.fetchedAt.getTime() > yearAgo);
      return mid((recent.length ? recent : all).map((s) => s.priceCents));
    };
    out.set(isbn, {
      used: pick((s) => s.condition !== "new"),
      new: pick((s) => s.condition === "new"),
    });
  }
  return out;
}

// the cheapest new and the cheapest used print copy in stock among each
// volume's prices now, with the store and link: for the shelf tools
// (collector/). The same believable-price rule as getKnownPrices; database
// only, never a lookup
export type CheapestCopy = { cents: number; store: string; url: string | null };
export async function getCheapestCopies(
  isbns: string[],
): Promise<
  Map<string, { new: CheapestCopy | null; used: CheapestCopy | null }>
> {
  const out = new Map<
    string,
    { new: CheapestCopy | null; used: CheapestCopy | null }
  >();
  if (!isbns.length) return out;
  const [rows, looked, usual] = await Promise.all([
    currentRows(isbns),
    lookedAt(isbns),
    newMedians(isbns),
  ]);
  const cheapest = (offers: CurrentRow[]): CheapestCopy | null => {
    const best = offers.reduce<CurrentRow | null>(
      (a, b) => (!a || b.priceCents < a.priceCents ? b : a),
      null,
    );
    return best && { cents: best.priceCents, store: best.store, url: best.url };
  };
  for (const [isbn, group] of groupBy(rows, (row) => row.isbn13.trim())) {
    const copies = dropUnlikelyNew(
      currentOf(group, looked.get(isbn)),
      usual.get(isbn),
    ).filter((o) => o.inStock && o.format === "print");
    out.set(isbn, {
      new: cheapest(copies.filter((o) => o.condition === "new")),
      used: cheapest(copies.filter((o) => o.condition !== "new")),
    });
  }
  return out;
}

// the cheapest new print price from each volume's latest check, for showing
// prices on series pages and shelves without fetching anything
export async function getKnownPrices(
  isbns: string[],
): Promise<Map<string, { priceCents: number; checkedAt: Date }>> {
  if (!isbns.length) return new Map();
  const [rows, looked, checks, usual] = await Promise.all([
    currentRows(isbns),
    lookedAt(isbns),
    // "checked": the oldest of each volume's source checks, as on its page
    prisma.priceSourceCheck.groupBy({
      by: ["isbn13"],
      where: { isbn13: { in: isbns } },
      _min: { checkedAt: true },
    }),
    newMedians(isbns),
  ]);
  const usualOf = usual;
  const checkedAt = new Map(
    checks.flatMap((c) =>
      c._min.checkedAt ? [[c.isbn13.trim(), c._min.checkedAt] as const] : [],
    ),
  );
  const known = new Map<string, { priceCents: number; checkedAt: Date }>();
  for (const [isbn, group] of groupBy(rows, (row) => row.isbn13.trim())) {
    // checks saved before a rule changed still get held to it
    const priceCents = lowestBelievableNew(
      currentOf(group, looked.get(isbn)),
      usualOf.get(isbn),
    );
    const at = checkedAt.get(isbn);
    if (priceCents !== null && at)
      known.set(isbn, { priceCents, checkedAt: at });
  }
  return known;
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
