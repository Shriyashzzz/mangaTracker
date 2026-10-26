import { pool } from "./pool.js";

const getBook = async (isbn13) => {
  const { rows } = await pool.query(`SELECT * FROM books WHERE isbn13 = $1`, [
    isbn13,
  ]);
  return rows[0];
};

const upsertBook = async (book) => {
  await pool.query(
    `
    INSERT INTO books (isbn13, title, authors, publisher, cover_url, year)
    VALUES ($1, $2, $3, $4, $5, $6)
    ON CONFLICT (isbn13) DO UPDATE
      SET title = EXCLUDED.title, authors = EXCLUDED.authors,
          publisher = EXCLUDED.publisher, cover_url = EXCLUDED.cover_url,
          year = EXCLUDED.year, updated_at = now()
    `,
    [
      book.isbn13,
      book.title,
      book.authors,
      book.publisher,
      book.coverUrl,
      book.year,
    ],
  );
};

const getLastCheck = async (isbn13) => {
  const { rows } = await pool.query(
    `SELECT checked_at, sources FROM price_checks WHERE isbn13 = $1`,
    [isbn13],
  );
  return rows[0];
};

// records one round of fetching: the check itself plus every offer found
const saveCheck = async (isbn13, sources, offers) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `
      INSERT INTO price_checks (isbn13, checked_at, sources)
      VALUES ($1, now(), $2)
      ON CONFLICT (isbn13) DO UPDATE
        SET checked_at = now(), sources = EXCLUDED.sources
      `,
      [isbn13, sources],
    );
    for (const o of offers) {
      await client.query(
        `
        INSERT INTO price_samples
          (isbn13, store, format, condition, price_cents, currency, in_stock, url)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `,
        [
          isbn13,
          o.store,
          o.format,
          o.condition,
          o.priceCents,
          o.currency,
          o.inStock,
          o.url,
        ],
      );
    }
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
};

// the most recent offer from each store + format + condition since `since`
const getLatestOffers = async (isbn13, since) => {
  const { rows } = await pool.query(
    `
    SELECT DISTINCT ON (store, format, condition)
      store, format, condition, price_cents, currency, in_stock, url, fetched_at
    FROM price_samples
    WHERE isbn13 = $1 AND fetched_at >= $2
    ORDER BY store, format, condition, fetched_at DESC
    `,
    [isbn13, since],
  );
  return rows.sort((a, b) => a.price_cents - b.price_cents);
};

// all-time stats for new print copies, the price people actually compare.
// Each check's cheapest new copy is one data point, like manga.london's
// "samples"; a "change" is a check whose best price differs from the last
const getPriceStats = async (isbn13) => {
  const { rows } = await pool.query(
    `
    WITH best AS (
      SELECT fetched_at, MIN(price_cents) AS p
      FROM price_samples
      WHERE isbn13 = $1 AND condition = 'new' AND format = 'print'
      GROUP BY fetched_at
    ),
    ordered AS (
      SELECT p, fetched_at, LAG(p) OVER (ORDER BY fetched_at) AS prev FROM best
    )
    SELECT
      (SELECT COUNT(*) FROM best)::int AS samples,
      (SELECT MIN(p) FROM best) AS low_cents,
      (SELECT MAX(p) FROM best) AS high_cents,
      (SELECT ROUND(AVG(p)) FROM best)::int AS avg_cents,
      (SELECT ROUND(percentile_cont(0.5) WITHIN GROUP (ORDER BY p)) FROM best)::int
        AS median_cents,
      (SELECT fetched_at FROM best ORDER BY p ASC, fetched_at ASC LIMIT 1) AS low_at,
      (SELECT fetched_at FROM best ORDER BY p DESC, fetched_at ASC LIMIT 1) AS high_at,
      (SELECT MIN(fetched_at) FROM best) AS since,
      (SELECT MAX(fetched_at) FROM best) AS last_seen,
      (SELECT COUNT(*) FROM ordered WHERE prev IS NOT NULL AND p <> prev)::int
        AS changes
    `,
    [isbn13],
  );
  return rows[0];
};

// the cheapest new print price from each volume's latest check, for showing
// prices on series pages without fetching anything
const getKnownPrices = async (isbns) => {
  if (!isbns.length) return new Map();
  const { rows } = await pool.query(
    `
    SELECT pc.isbn13, MIN(ps.price_cents) AS price_cents, pc.checked_at
    FROM price_checks pc
    JOIN price_samples ps
      ON ps.isbn13 = pc.isbn13 AND ps.fetched_at = pc.checked_at
     AND ps.condition = 'new' AND ps.format = 'print'
    WHERE pc.isbn13 = ANY($1)
    GROUP BY pc.isbn13, pc.checked_at
    `,
    [isbns],
  );
  return new Map(rows.map((r) => [r.isbn13.trim(), r]));
};

// recently checked volumes with their latest best price and their average,
// so the price home page can show deals and recent checks for free
const getRecentBestPrices = async (limit = 40) => {
  const { rows } = await pool.query(
    `
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
    SELECT b.isbn13, b.title, b.cover_url, l.p AS price_cents, l.fetched_at,
           ROUND(a.avg_p)::int AS avg_cents, a.n AS samples
    FROM latest l
    JOIN averages a USING (isbn13)
    JOIN books b USING (isbn13)
    -- only US English editions on the price home page
    WHERE l.isbn13 ~ '^(9780|9781|9798)'
      AND b.title !~ '[぀-ヿ一-鿿]'
      -- numbered volumes only: keeps other books that share a name out
      AND b.title ~* 'vol(ume)?[.]?[[:space:]]*[0-9]'
    ORDER BY l.fetched_at DESC
    LIMIT $1
    `,
    [limit],
  );
  return rows;
};

// takes one call from this month's allowance; false once it's used up.
// A single statement, so two requests at once can't both take the last one
const claimApiCall = async (provider, limit) => {
  const { rowCount } = await pool.query(
    `
    INSERT INTO api_usage (provider, month, calls)
    VALUES ($1, date_trunc('month', now())::date, 1)
    ON CONFLICT (provider, month) DO UPDATE
      SET calls = api_usage.calls + 1
      WHERE api_usage.calls < $2
    `,
    [provider, limit],
  );
  return rowCount === 1;
};

// known edition covers; a "has none" answer only counts for a month
const getCoverIds = async (isbns) => {
  const { rows } = await pool.query(
    `
    SELECT isbn13, cover_id FROM edition_covers
    WHERE isbn13 = ANY($1)
      AND (cover_id IS NOT NULL OR checked_at > now() - interval '30 days')
    `,
    [isbns],
  );
  return rows;
};

const saveCoverIds = async (found) => {
  await pool.query(
    `
    INSERT INTO edition_covers (isbn13, cover_id)
    SELECT * FROM unnest($1::char(13)[], $2::integer[])
    ON CONFLICT (isbn13) DO UPDATE
      SET cover_id = EXCLUDED.cover_id, checked_at = now()
    `,
    [found.map(([isbn]) => isbn), found.map(([, id]) => id)],
  );
};

// everything worth a search engine's time: each US volume we know, and each
// series once (several searched names can lead to the same AniList entry)
const getSitemapEntries = async () => {
  const [volumes, series] = await Promise.all([
    pool.query(
      `
      SELECT b.isbn13, b.title, GREATEST(b.updated_at, pc.checked_at) AS updated
      FROM books b LEFT JOIN price_checks pc USING (isbn13)
      ORDER BY b.isbn13
      `,
    ),
    pool.query(
      `
      SELECT DISTINCT ON (info->>'anilistId') info->>'name' AS name, fetched_at
      FROM series_info
      WHERE info IS NOT NULL AND info->>'name' IS NOT NULL
      ORDER BY info->>'anilistId', fetched_at DESC
      `,
    ),
  ]);
  return { volumes: volumes.rows, series: series.rows };
};

export default {
  claimApiCall,
  getKnownPrices,
  getRecentBestPrices,
  getBook,
  upsertBook,
  getLastCheck,
  saveCheck,
  getLatestOffers,
  getPriceStats,
  getCoverIds,
  saveCoverIds,
  getSitemapEntries,
};
