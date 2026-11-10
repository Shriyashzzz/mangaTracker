// Everything the price checker stores: books (volumes), the prices we've
// fetched for them, when each was last checked, cached edition covers, and
// the monthly allowance of paid APIs.
//
// Simple reads and writes use Prisma's query builder. The statistics need
// window functions and DISTINCT ON, which Prisma can't express, so those are
// raw SQL ($queryRaw tagged templates: values are always sent as parameters,
// never pasted into the SQL).
import type { Spender } from "../prices/spender.js";
import { VOLUMES_KEY_VERSION } from "../prices/volumesKey.js";
import { prisma } from "../config/prisma.js";
import { Prisma, type Book } from "../../generated/prisma/client.js";
import {
  dropUnlikelyNew,
  lowestBelievableNew,
  unlikelyNewTest,
} from "../prices/stores/retailers.js";
import {
  AMAZON,
  EBAY,
  preferDirectRows,
  storeName,
} from "../prices/stores/storeLinks.js";
import type { CatalogBook, Offer } from "../prices/types.js";

export type { Book };

// a book as the catalog hands it to us, before it's stored
type NewBook = Pick<
  Book,
  "isbn13" | "title" | "authors" | "publisher" | "coverUrl" | "year"
>;

type StoredOffer = Offer & { fetchedAt: Date };

// what kind of copy a price is for, in the history: new print, used and
// marketplace copies together, and ebooks
type PriceKind = "new" | "marketplace" | "ebook";

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

// records one round of fetching. Each source group that answered gets this
// moment as its last check, and its offers (maybe none) saved with it: those
// replace that group's prices, while groups not asked keep theirs.
// price_checks keeps the latest look of any group, for "checked ... ago"
export async function saveCheck(
  isbn13: string,
  sources: string[],
  groups: Map<string, Offer[]>,
) {
  const at = new Date();
  await prisma.$transaction([
    // only when a source answered: Google Shopping found not needed isn't a look
    ...(sources.length
      ? [
          prisma.priceCheck.upsert({
            where: { isbn13 },
            create: { isbn13, sources, checkedAt: at },
            update: { sources, checkedAt: at },
          }),
        ]
      : []),
    prisma.priceSample.createMany({
      data: [...groups].flatMap(([source, offers]) =>
        offers.map((o) => ({ ...o, isbn13, source, fetchedAt: at })),
      ),
    }),
    ...[...groups.keys()].map((source) =>
      prisma.priceSourceCheck.upsert({
        where: { isbn13_source: { isbn13, source } },
        create: { isbn13, source, checkedAt: at },
        update: { checkedAt: at },
      }),
    ),
  ]);
}

// when each source group last looked at this volume
export async function getSourceChecks(isbn13: string) {
  const rows = await prisma.priceSourceCheck.findMany({
    where: { isbn13 },
    select: { source: true, checkedAt: true },
  });
  return new Map(rows.map((r) => [r.source, r.checkedAt]));
}

type CurrentRow = StoredOffer & { isbn13: string; source: string };

// the prices of each group's last check, as one list: where Google Shopping
// and a store's own listing both have a store, the store's own (our affiliate
// link) wins, and of the rest the most recent copy of each store + format +
// condition. Cheapest first
// A store with its own source (eBay, Amazon) that has looked is the word on
// that store: Google Shopping's older row for it stops showing, even when the
// store's own source found none
const currentOf = (
  rows: CurrentRow[],
  looked: Set<string> = new Set(),
): CurrentRow[] => {
  const latest = new Map<string, CurrentRow>();
  const ownWord = (row: CurrentRow) =>
    row.source === "shopping" &&
    ((looked.has("ebay") && EBAY.test(row.store)) ||
      (looked.has("amazon") && AMAZON.test(row.store)));
  for (const found of preferDirectRows(rows)) {
    if (ownWord(found)) continue;
    // one store, one name: Google Shopping's spellings as the store links'
    const row = { ...found, store: storeName(found.store) };
    const key = `${row.store}|${row.format}|${row.condition}`;
    const kept = latest.get(key);
    // the newest copy of each; from the same look, the cheaper one
    const newer = kept && new Date(row.fetchedAt) > new Date(kept.fetchedAt);
    const sameLook =
      kept &&
      new Date(row.fetchedAt).getTime() === new Date(kept.fetchedAt).getTime();
    if (!kept || newer || (sameLook && row.priceCents < kept.priceCents))
      latest.set(key, row);
  }
  return [...latest.values()].sort((a, b) => a.priceCents - b.priceCents);
};

const currentRows = (isbns: string[]) =>
  prisma.$queryRaw<CurrentRow[]>`
    SELECT ps.isbn13, ps.source, ps.store, ps.format, ps.condition,
           ps.price_cents AS "priceCents", ps.currency, ps.in_stock AS "inStock",
           ps.url, ps.fetched_at AS "fetchedAt"
    FROM price_source_checks sc
    JOIN price_samples ps
      ON ps.isbn13 = sc.isbn13 AND ps.source = sc.source
     AND ps.fetched_at = sc.checked_at
    WHERE sc.isbn13 = ANY(${isbns}::text[])
  `;

// the groups that have looked at each of these volumes
const lookedAt = async (isbns: string[]) => {
  const rows = await prisma.priceSourceCheck.findMany({
    where: { isbn13: { in: isbns } },
    select: { isbn13: true, source: true },
  });
  const groups = new Map<string, Set<string>>();
  for (const r of rows) {
    const isbn = r.isbn13.trim();
    groups.set(isbn, (groups.get(isbn) ?? new Set()).add(r.source));
  }
  return groups;
};

// a volume's prices now: each source group's from its last check, each
// saying which group it came from
export async function getCurrentRows(isbn13: string) {
  const [rows, looked] = await Promise.all([
    currentRows([isbn13]),
    lookedAt([isbn13]),
  ]);
  return currentOf(rows, looked.get(isbn13));
}

// the same, as plain offers for pages
export async function getCurrentOffers(isbn13: string): Promise<StoredOffer[]> {
  return (await getCurrentRows(isbn13)).map(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    ({ isbn13: _isbn, source: _source, ...offer }) => offer,
  );
}

const groupBy = <T, K>(items: T[], keyOf: (item: T) => K) => {
  const groups = new Map<K, T[]>();
  for (const item of items) {
    const key = keyOf(item);
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }
  return groups;
};

// samples saved before a rule changed, that it would have kept out: each is judged
// against the other copies in its own check, the same way a new check is
async function getUnbelievableSampleIds(
  isbn13: string,
  median?: number | null,
) {
  const [rows, usual] = await Promise.all([
    prisma.$queryRaw<(StoredOffer & { id: string })[]>`
      SELECT id::text AS id, store, format, condition, price_cents AS "priceCents",
             currency, in_stock AS "inStock", url, fetched_at AS "fetchedAt"
      FROM price_samples
      WHERE isbn13 = ${isbn13} AND in_stock
    `,
    median !== undefined ? median : getNewPriceMedian(isbn13),
  ]);
  const checks = groupBy(rows, (row) => new Date(row.fetchedAt).getTime());
  return [...checks.values()].flatMap((check) => {
    const unlikely = unlikelyNewTest(check, usual);
    return check.filter(unlikely).map((row) => row.id);
  });
}

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
    {
      isbn13: string;
      used_recent: number | null;
      used_all: number | null;
      new_recent: number | null;
      new_all: number | null;
    }[]
  >`
    SELECT isbn13,
      ROUND(percentile_cont(0.5) WITHIN GROUP (ORDER BY price_cents)
        FILTER (WHERE condition <> 'new' AND fetched_at > now() - interval '12 months'))::int AS used_recent,
      ROUND(percentile_cont(0.5) WITHIN GROUP (ORDER BY price_cents)
        FILTER (WHERE condition <> 'new'))::int AS used_all,
      ROUND(percentile_cont(0.5) WITHIN GROUP (ORDER BY price_cents)
        FILTER (WHERE condition = 'new' AND fetched_at > now() - interval '12 months'))::int AS new_recent,
      ROUND(percentile_cont(0.5) WITHIN GROUP (ORDER BY price_cents)
        FILTER (WHERE condition = 'new'))::int AS new_all
    FROM price_samples
    WHERE isbn13 = ANY(${isbns}::text[]) AND in_stock AND format = 'print'
    GROUP BY isbn13
  `;
  return new Map(
    rows.map((r) => [
      r.isbn13.trim(),
      { used: r.used_recent ?? r.used_all, new: r.new_recent ?? r.new_all },
    ]),
  );
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

type RecentPrice = {
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
// it reads every saved price, and the home page asks on each load: kept a few
// minutes
const RECENT_MS = 5 * 60 * 1000;
const recent = new Map<number, { at: number; rows: Promise<RecentPrice[]> }>();
export function getRecentBestPrices(limit = 40): Promise<RecentPrice[]> {
  const hit = recent.get(limit);
  if (hit && Date.now() - hit.at < RECENT_MS) return hit.rows;
  const rows = queryRecentBestPrices(limit);
  recent.set(limit, { at: Date.now(), rows });
  // a failure isn't kept
  rows.catch(() => recent.delete(limit));
  return rows;
}

async function queryRecentBestPrices(limit: number): Promise<RecentPrice[]> {
  return prisma.$queryRaw<RecentPrice[]>`
    -- each check's cheapest new print copy, and whether the check went past
    -- eBay (eBay alone looks again every few days)
    WITH best AS (
      SELECT isbn13, fetched_at, MIN(price_cents) AS p,
             bool_or(source IS DISTINCT FROM 'ebay') AS full_check
      FROM price_samples
      WHERE condition = 'new' AND format = 'print'
      GROUP BY isbn13, fetched_at
    ),
    -- each volume's cheapest new print copy among its prices now (each
    -- source group's last check)
    latest AS (
      -- dated by the oldest of its source checks, as its page says "checked",
      -- so eBay looking again every few days doesn't move it to the top
      SELECT ps.isbn13,
             (SELECT MIN(s2.checked_at) FROM price_source_checks s2
               WHERE s2.isbn13 = ps.isbn13) AS fetched_at,
             MIN(ps.price_cents) AS p
      FROM price_source_checks sc
      JOIN price_samples ps
        ON ps.isbn13 = sc.isbn13 AND ps.source = sc.source
       AND ps.fetched_at = sc.checked_at
      WHERE ps.condition = 'new' AND ps.format = 'print'
      GROUP BY ps.isbn13
    ),
    -- the usual price: from the full checks, or eBay's when it's all there is
    averages AS (
      SELECT isbn13,
             COALESCE(AVG(p) FILTER (WHERE full_check), AVG(p)) AS avg_p,
             COALESCE(NULLIF(COUNT(*) FILTER (WHERE full_check), 0), COUNT(*))::int AS n
      FROM best GROUP BY isbn13
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
// `month` (YYYY-MM-01): the allowance's own month, when it doesn't follow the
// database's clock (eBay's days run on Pacific time). A limit of 0 allows none
export async function claimApiCall(
  provider: string,
  limit: number,
  month?: string,
) {
  const changed = await prisma.$executeRaw`
    INSERT INTO api_usage (provider, month, calls)
    SELECT ${provider}, COALESCE(${month ?? null}::date, date_trunc('month', now())::date), 1
    WHERE ${limit} > 0
    ON CONFLICT (provider, month) DO UPDATE
      SET calls = api_usage.calls + 1
      WHERE api_usage.calls < ${limit}
  `;
  return changed === 1;
}

// whether any of these providers still has searches this month, without
// claiming one
export async function anyCallsLeft(
  providers: string[],
  limit: number,
  month?: string,
) {
  if (!providers.length || limit <= 0) return false;
  const used = await prisma.$queryRaw<{ provider: string; calls: number }[]>`
    SELECT provider, calls FROM api_usage
    WHERE month = COALESCE(${month ?? null}::date, date_trunc('month', now())::date)
      AND provider = ANY(${providers})
  `;
  const calls = new Map(used.map((u) => [u.provider, u.calls]));
  return providers.some((p) => (calls.get(p) ?? 0) < limit);
}

// one search SerpApi answered, added to whoever it was spent for
export async function recordSearch(spender: Spender) {
  if ("userId" in spender) {
    // updateMany: an account deleted mid-search just matches nothing
    await prisma.user.updateMany({
      where: { id: spender.userId },
      data: { serpapiSearches: { increment: 1 } },
    });
    return;
  }
  await prisma.$executeRaw`
    INSERT INTO guest_searches (visitor, month, searches, user_agent)
    VALUES (${spender.visitor}, date_trunc('month', now())::date, 1, ${spender.userAgent})
    ON CONFLICT (visitor, month) DO UPDATE
      SET searches = guest_searches.searches + 1,
          user_agent = EXCLUDED.user_agent,
          last_at = now()
  `;
}

// the provider says this allowance is gone, whatever our own count thinks
export async function markApiSpent(
  provider: string,
  limit: number,
  month?: string,
) {
  await prisma.$executeRaw`
    INSERT INTO api_usage (provider, month, calls)
    VALUES (${provider}, COALESCE(${month ?? null}::date, date_trunc('month', now())::date), ${limit})
    ON CONFLICT (provider, month) DO UPDATE
      SET calls = GREATEST(api_usage.calls, ${limit})
  `;
}

// a volume as a series' saved list knows it (the newest list, today's naming
// first). Open Library's own record for an ISBN can be the Japanese title it
// can't name ("オーバーロード15 半森妖精の神人 ［上］"), while the series found
// the English edition inside the work
export async function getSavedVolume(isbn13: string) {
  const [row] = await prisma.$queryRaw<{ volume: CatalogBook }[]>`
    SELECT v AS volume
    FROM series_volumes sv, jsonb_array_elements(sv.volumes) v
    -- only lists saved since light novels were told apart (v3): an older one can
    -- hold a novel's volume under the manga's name
    WHERE sv.key LIKE ${VOLUMES_KEY_VERSION + "%"}
      AND sv.volumes @> ${JSON.stringify([{ isbn13 }])}::jsonb
      AND v->>'isbn13' = ${isbn13}
    ORDER BY sv.fetched_at DESC
    LIMIT 1
  `;
  return row?.volume ?? null;
}

// a volume we know is manga, not any ISBN someone typed in: in a series'
// saved volume list, or priced before (only known volumes get priced, and
// lists are only saved once someone opens the series). For Canada's searches
// how many volumes each of these saved lists has, and the first one's cover
// (missing: never built)
export async function getSavedListSizes(keys: string[]) {
  type Size = { size: number; coverUrl: string | null };
  if (!keys.length) return new Map<string, Size>();
  const rows = await prisma.$queryRaw<(Size & { key: string })[]>`
    SELECT key, jsonb_array_length(volumes)::int AS size,
           volumes->0->>'coverUrl' AS "coverUrl"
    FROM series_volumes WHERE key IN (${Prisma.join(keys)})
  `;
  return new Map(
    rows.map((r) => [r.key, { size: r.size, coverUrl: r.coverUrl }]),
  );
}

// novels the background finder found for these manga (prices/novelFinder.ts),
// by the manga's normalized name
export async function getFoundNovels(keys: string[]) {
  if (!keys.length) return new Map<string, { name: string; volumes: number }>();
  const rows = await prisma.novelCheck.findMany({
    where: { key: { in: keys }, volumes: { gt: 0 }, name: { not: null } },
  });
  return new Map(
    rows.map((r) => [r.key, { name: r.name!, volumes: r.volumes }]),
  );
}

export async function isKnownVolume(isbn13: string) {
  const [row] = await prisma.$queryRaw<{ known: boolean }[]>`
    SELECT EXISTS (
      SELECT 1 FROM series_volumes
      WHERE volumes @> ${JSON.stringify([{ isbn13 }])}::jsonb
    ) OR EXISTS (
      SELECT 1 FROM price_checks WHERE isbn13 = ${isbn13}
    ) AS known
  `;
  return Boolean(row?.known);
}

// a series' last good volume list; see prices/service.ts
export async function getSeriesVolumes(key: string) {
  const row = await prisma.seriesVolumes.findUnique({ where: { key } });
  return (
    row && {
      at: row.fetchedAt.getTime(),
      volumes: row.volumes as unknown as CatalogBook[],
    }
  );
}

export async function saveSeriesVolumes(key: string, volumes: CatalogBook[]) {
  const data = {
    volumes: volumes as unknown as Prisma.InputJsonValue,
    fetchedAt: new Date(),
  };
  await prisma.seriesVolumes.upsert({
    where: { key },
    create: { key, ...data },
    update: data,
  });
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

export default {
  claimApiCall,
  anyCallsLeft,
  markApiSpent,
  recordSearch,
  getSeriesVolumes,
  getSavedVolume,
  getSavedListSizes,
  getFoundNovels,
  saveSeriesVolumes,
  getKnownPrices,
  getCheapestCopies,
  getRecordedMedians,
  getRecentBestPrices,
  getBook,
  isKnownVolume,
  upsertBook,
  getLastCheck,
  saveCheck,
  getSourceChecks,
  getCurrentRows,
  getCurrentOffers,
  getPriceHistory,
  getNewPriceMedian,
  getCoverIds,
  saveCoverIds,
  getSitemapEntries,
  getBookTitles,
};
