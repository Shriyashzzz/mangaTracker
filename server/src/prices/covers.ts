// Covers for exact US editions. Open Library's by-ISBN cover images are
// rate limited, and so is its API: a burst of ~40 lookups gets 429s and then
// a short block of the whole server. So the server finds each edition's
// cover ID once, keeps it in Postgres, and points the browser at the
// unlimited by-ID image. Lookups that do reach Open Library are gathered
// into batches (one request answers up to 40 ISBNs), go out one at a time,
// and stop for a while when Open Library asks us to slow down.
//
//   browser ── GET /api/prices/cover/:isbn ──> editionCoverId(isbn)
//     memory (known) ─> database (edition_covers) ─> Open Library batch
//   then 302 to https://covers.openlibrary.org/b/id/<id>-M.jpg
//
// https://openlibrary.org/dev/docs/api/books
// https://openlibrary.org/dev/docs/api/covers
import priceQueries from "../models/priceQueries.js";

const BOOKS_URL = "https://openlibrary.org/api/books";
const BATCH_SIZE = 40;
// how long to wait for more lookups before sending a batch; a series page
// asks for all its covers within a few milliseconds
const GATHER_MS = 40;
// how long to back off when throttled and Open Library doesn't say
const DEFAULT_PAUSE_MS = 60_000;

type CoverId = number | null;

// thrown while we're backing off, so the cover route can say "later"
export class CoverLookupPaused extends Error {
  constructor(public retryAfterMs: number) {
    super("Open Library asked us to slow down");
  }
}

type Waiting = {
  isbn13: string;
  resolve: (id: CoverId) => void;
  reject: (e: Error) => void;
};

// isbn -> cover id | null, for answers we're sure of
const known = new Map<string, CoverId>();
// isbn -> lookup in progress, so a lookup is only made once at a time
const inFlight = new Map<string, Promise<CoverId>>();
// lookups waiting for the next batch
let waiting: Waiting[] = [];
let gatherTimer: NodeJS.Timeout | null = null;
let pausedUntil = 0;
// batches go to Open Library one after another, never side by side
let upstream: Promise<void> = Promise.resolve();

// where the browser asks for a cover; answered by the cover route
export const coverPath = (isbn13: string) => `/api/prices/cover/${isbn13}`;

export function editionCoverId(isbn13: string): Promise<CoverId> {
  if (known.has(isbn13)) return Promise.resolve(known.get(isbn13) ?? null);
  const pending = inFlight.get(isbn13);
  if (pending) return pending;

  const lookup = new Promise<CoverId>((resolve, reject) => {
    waiting.push({ isbn13, resolve, reject });
    gatherTimer ??= setTimeout(sendBatch, GATHER_MS);
  });
  inFlight.set(isbn13, lookup);
  // a failed lookup is forgotten so it's tried again later
  lookup
    .then((id) => known.set(isbn13, id))
    .catch(() => {})
    .finally(() => inFlight.delete(isbn13));
  return lookup;
}

async function sendBatch() {
  gatherTimer = null;
  const batch = waiting;
  waiting = [];
  const settle = (isbn13: string, outcome: CoverId | Error) =>
    batch
      .filter((w) => w.isbn13 === isbn13)
      .forEach((w) =>
        outcome instanceof Error ? w.reject(outcome) : w.resolve(outcome),
      );
  let isbns = [...new Set(batch.map((w) => w.isbn13))];

  // most answers are already in the database
  try {
    const rows = await priceQueries.getCoverIds(isbns);
    for (const row of rows) settle(row.isbn13.trim(), row.coverId);
    const cached = new Set(rows.map((row) => row.isbn13.trim()));
    isbns = isbns.filter((i) => !cached.has(i));
  } catch (e) {
    console.error("cover cache read failed:", (e as Error).message);
  }
  if (isbns.length === 0) return;

  for (let i = 0; i < isbns.length; i += BATCH_SIZE) {
    const chunk = isbns.slice(i, i + BATCH_SIZE);
    upstream = upstream.then(() =>
      lookUpChunk(chunk).then(
        (ids) => chunk.forEach((isbn) => settle(isbn, ids.get(isbn) ?? null)),
        (e: Error) => chunk.forEach((isbn) => settle(isbn, e)),
      ),
    );
  }
}

type Editions = Record<string, { cover?: { medium?: string; large?: string } }>;

async function lookUpChunk(isbns: string[]): Promise<Map<string, CoverId>> {
  const wait = pausedUntil - Date.now();
  if (wait > 0) throw new CoverLookupPaused(wait);

  const url = new URL(BOOKS_URL);
  url.searchParams.set("bibkeys", isbns.map((i) => `ISBN:${i}`).join(","));
  url.searchParams.set("jscmd", "data");
  url.searchParams.set("format", "json");

  let res: Response;
  try {
    res = await fetch(url, {
      headers: { "User-Agent": "MangaTracker/1.0 (+https://mangatracker.xyz)" },
      signal: AbortSignal.timeout(15_000),
    });
  } catch (e) {
    // a refused connection is how Open Library's block looks from here
    pausedUntil = Date.now() + DEFAULT_PAUSE_MS / 2;
    throw e;
  }
  if (res.status === 429 || res.status === 503) {
    const retryAfter = Number(res.headers.get("Retry-After"));
    const pause = retryAfter > 0 ? retryAfter * 1000 : DEFAULT_PAUSE_MS;
    pausedUntil = Date.now() + pause;
    throw new CoverLookupPaused(pause);
  }
  if (!res.ok) throw new Error(`Open Library responded ${res.status}`);

  const editions = (await res.json()) as Editions;
  const ids = new Map<string, CoverId>(
    isbns.map((isbn) => {
      const cover = editions[`ISBN:${isbn}`]?.cover;
      const match = (cover?.medium ?? cover?.large ?? "").match(/\/id\/(\d+)-/);
      return [isbn, match ? Number(match[1]) : null];
    }),
  );
  priceQueries
    .saveCoverIds([...ids])
    .catch((e: Error) => console.error("cover cache write failed:", e.message));
  return ids;
}

export type CoverSize = "M" | "L";

export const coverImageUrl = (id: number, size: CoverSize = "M") =>
  `https://covers.openlibrary.org/b/id/${id}-${size}.jpg`;

// the same cover found by ISBN on the image host; rate limited per visitor,
// so only a fallback. default=false makes a missing cover a 404, not a blank
export const isbnCoverImageUrl = (isbn13: string, size: CoverSize = "M") =>
  `https://covers.openlibrary.org/b/isbn/${isbn13}-${size}.jpg?default=false`;
