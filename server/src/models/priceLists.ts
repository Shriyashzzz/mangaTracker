// The lists the price home and the deals page show: recently checked
// volumes and the ones well under their usual price. Part of the price
// queries (priceQueries.ts lists the parts).
import { prisma } from "../config/prisma.js";
import { type RecentPrice } from "./priceHistory.js";

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
    -- the free sources (eBay, Books-A-Million, Better World Books: they alone
    -- look again every few days)
    WITH best AS (
      SELECT isbn13, fetched_at, MIN(price_cents) AS p,
             bool_or(source IS NULL OR source NOT IN ('ebay', 'books-a-million', 'better-world-books')) AS full_check
      FROM price_samples
      WHERE condition = 'new' AND format = 'print'
      GROUP BY isbn13, fetched_at
    ),
    -- each volume's cheapest new print copy among its prices now (each
    -- source group's last check)
    latest AS (
      -- dated by the oldest of its source checks, as its page says "checked",
      -- so eBay or Books-A-Million looking again every few days doesn't move
      -- it to the top
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
      -- not one only the background pricing has looked at (a reader's
      -- shelf, not a lookup): it shows once someone opens it
      AND NOT EXISTS (
        SELECT 1 FROM price_checks pc
        WHERE pc.isbn13 = l.isbn13 AND 'fill' = ANY(pc.sources)
      )
    ORDER BY l.fetched_at DESC
    LIMIT ${limit}
  `;
}

// volumes whose cheapest new print copy now is well under their usual new
// price (the /deals page): any priced volume, not just recent lookups, as
// long as its prices were checked lately. Biggest discount first. Cached a
// few minutes like the recent ones, since the page asks on every load
const DEALS_MS = 5 * 60 * 1000;
const DEAL_SHARE = 0.9;
const DEALS_FRESH_DAYS = 21;
let deals: { at: number; rows: Promise<RecentPrice[]> } | null = null;

export function getDeals(limit = 60): Promise<RecentPrice[]> {
  if (deals && Date.now() - deals.at < DEALS_MS) return deals.rows;
  const rows = queryDeals(limit);
  deals = { at: Date.now(), rows };
  rows.catch(() => (deals = null));
  return rows;
}

async function queryDeals(limit: number): Promise<RecentPrice[]> {
  return prisma.$queryRaw<RecentPrice[]>`
    WITH best AS (
      SELECT isbn13, fetched_at, MIN(price_cents) AS p,
             bool_or(source IS NULL OR source NOT IN ('ebay', 'books-a-million', 'better-world-books')) AS full_check
      FROM price_samples
      WHERE condition = 'new' AND format = 'print'
      GROUP BY isbn13, fetched_at
    ),
    latest AS (
      SELECT ps.isbn13,
             (SELECT MIN(s2.checked_at) FROM price_source_checks s2
               WHERE s2.isbn13 = ps.isbn13) AS fetched_at,
             MIN(ps.price_cents) AS p
      FROM price_source_checks sc
      JOIN price_samples ps
        ON ps.isbn13 = sc.isbn13 AND ps.source = sc.source
       AND ps.fetched_at = sc.checked_at
      WHERE ps.condition = 'new' AND ps.format = 'print' AND ps.in_stock
      GROUP BY ps.isbn13
    ),
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
    WHERE l.isbn13 ~ '^(9780|9781|9798)'
      AND b.title !~ '[぀-ヿ一-鿿]'
      AND b.title ~* 'vol(ume)?[.]?[[:space:]]*[0-9]'
      AND a.n >= 2
      AND l.p < a.avg_p * ${DEAL_SHARE}
      AND l.fetched_at > now() - make_interval(days => ${DEALS_FRESH_DAYS})
    ORDER BY l.p / a.avg_p ASC
    LIMIT ${limit}
  `;
}
