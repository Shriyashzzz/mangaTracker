// Covers for exact US editions. Open Library's by-ISBN cover images are
// rate limited (about 100 per visitor every 5 minutes), while by-ID ones are
// not. So the server looks each edition's cover ID up once, remembers it,
// and points the browser at the unlimited by-ID image.
// https://openlibrary.org/dev/docs/api/covers
const EDITION_URL = "https://openlibrary.org/isbn";
const MAX_PARALLEL = 6;

// isbn -> Promise<cover id | null>. Kept for the server's life; a failed
// lookup is forgotten so it's tried again later
const coverIds = new Map();

// a small queue so a 30-volume page doesn't fire 30 requests at once
let running = 0;
const waiting = [];
const slot = () =>
  new Promise((resolve) => {
    if (running < MAX_PARALLEL) {
      running += 1;
      resolve();
    } else waiting.push(resolve);
  });
const release = () => {
  const next = waiting.shift();
  if (next) next();
  else running -= 1;
};

// where the browser asks for a cover; answered by the cover route
export const coverPath = (isbn13) => `/api/prices/cover/${isbn13}`;

export function editionCoverId(isbn13) {
  if (coverIds.has(isbn13)) return coverIds.get(isbn13);
  const lookup = (async () => {
    await slot();
    try {
      const res = await fetch(`${EDITION_URL}/${isbn13}.json`, {
        headers: { "User-Agent": "MangaTracker/1.0 (price checker)" },
        signal: AbortSignal.timeout(8000),
      });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`Open Library responded ${res.status}`);
      const { covers } = await res.json();
      // Open Library uses -1 for "cover removed"
      return covers?.find((id) => id > 0) ?? null;
    } finally {
      release();
    }
  })().catch((e) => {
    coverIds.delete(isbn13);
    throw e;
  });
  coverIds.set(isbn13, lookup);
  return lookup;
}

export const coverImageUrl = (id, size = "M") =>
  `https://covers.openlibrary.org/b/id/${id}-${size}.jpg`;
