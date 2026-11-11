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
import { openLibraryFetch } from "./openLibrary.js";
import config from "../../config/config.js";
import { prisma } from "../../config/prisma.js";
import priceQueries from "../../models/priceQueries.js";

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

// isbn -> cover id | null, for answers we're sure of. Capped, oldest out
// first, so asking about endless ISBNs can't grow memory without end: the
// database still has every answer
const KNOWN_MAX = 20_000;
const known = new Map<string, CoverId>();
const remember = (isbn13: string, id: CoverId) => {
  known.set(isbn13, id);
  if (known.size > KNOWN_MAX) known.delete(known.keys().next().value!);
};
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
    .then((id) => remember(isbn13, id))
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
    res = await openLibraryFetch(url, 15_000);
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

type CoverSize = "M" | "L";

export const coverImageUrl = (id: number, size: CoverSize = "M") =>
  `https://covers.openlibrary.org/b/id/${id}-${size}.jpg`;

// the same cover found by ISBN on the image host; rate limited per visitor,
// so only a fallback. default=false makes a missing cover a 404, not a blank
export const isbnCoverImageUrl = (isbn13: string, size: CoverSize = "M") =>
  `https://covers.openlibrary.org/b/isbn/${isbn13}-${size}.jpg?default=false`;

// ---------- Google Books, for editions Open Library has no cover for ----------

// About half of the US volumes we list have no cover on Open Library, and
// Google Books has most of them. Asked only for those, once per edition (the
// answer is kept in edition_covers; a "none" is asked again after 30 days),
// and never more than COVER_LOOKUPS_A_DAY a day, counted in api_usage like
// the stores' budgets: Google Books allows about 1,000 calls a day for the
// whole site, and the catalog lookups need most of them.
const GOOGLE_URL = "https://www.googleapis.com/books/v1/volumes";
const COVER_LOOKUPS_A_DAY = 300;
const RETRY_NONE_MS = 30 * 24 * 60 * 60 * 1000;
const coverDay = () => new Date().toISOString().slice(0, 10);
export const googleCoverLabel = (day = coverDay()) => `gbcover:${day}`;

// the thumbnail Google gives is 128px wide; its image host serves a sharper
// one when asked for a size (fife), and only over https
const sharper = (thumbnail: string) =>
  `${thumbnail.replace(/^http:/, "https:").replace(/&edge=curl/, "")}&fife=w400-h600`;

const asking = new Map<string, Promise<string | null>>();

// `ask`: false gives only a cover already found (a crawler's request never
// spends one of the day's lookups)
export function fallbackCover(
  isbn13: string,
  { ask = true }: { ask?: boolean } = {},
): Promise<string | null> {
  const pending = asking.get(isbn13);
  if (pending) return pending;
  const lookup = (async () => {
    const saved = await prisma.editionCover.findUnique({ where: { isbn13 } });
    if (saved?.fallbackUrl) return saved.fallbackUrl;
    if (!ask) return null;
    if (
      saved?.fallbackCheckedAt &&
      Date.now() - saved.fallbackCheckedAt.getTime() < RETRY_NONE_MS
    )
      return null;
    const day = coverDay();
    // today's share used: no cover for now, asked again another day
    if (
      !(await priceQueries.claimApiCall(
        googleCoverLabel(day),
        COVER_LOOKUPS_A_DAY,
        `${day.slice(0, 7)}-01`,
      ))
    )
      return null;
    const url = new URL(GOOGLE_URL);
    url.searchParams.set("q", `isbn:${isbn13}`);
    url.searchParams.set("fields", "items(volumeInfo/imageLinks/thumbnail)");
    if (config.GOOGLE_BOOKS_API_KEY)
      url.searchParams.set("key", config.GOOGLE_BOOKS_API_KEY);
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    // out of quota or down: nothing saved, so it's asked another time
    if (!res.ok) return null;
    const body = (await res.json()) as {
      items?: { volumeInfo?: { imageLinks?: { thumbnail?: string } } }[];
    };
    const thumbnail = body.items?.[0]?.volumeInfo?.imageLinks?.thumbnail;
    const found = thumbnail ? sharper(thumbnail) : null;
    await prisma.editionCover.upsert({
      where: { isbn13 },
      create: {
        isbn13,
        coverId: null,
        fallbackUrl: found,
        fallbackCheckedAt: new Date(),
      },
      update: { fallbackUrl: found, fallbackCheckedAt: new Date() },
    });
    return found;
  })();
  asking.set(isbn13, lookup);
  return lookup.finally(() => asking.delete(isbn13));
}
