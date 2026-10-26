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

// all-time stats for new print copies, the price people actually compare
const getPriceStats = async (isbn13) => {
  const { rows } = await pool.query(
    `
    SELECT
      COUNT(*)::int              AS samples,
      MIN(price_cents)           AS low_cents,
      MAX(price_cents)           AS high_cents,
      ROUND(AVG(price_cents))::int AS avg_cents,
      MIN(fetched_at)            AS since
    FROM price_samples
    WHERE isbn13 = $1 AND condition = 'new' AND format = 'print'
    `,
    [isbn13],
  );
  return rows[0];
};

export default {
  getBook,
  upsertBook,
  getLastCheck,
  saveCheck,
  getLatestOffers,
  getPriceStats,
};
