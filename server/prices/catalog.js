// Open Library: free, no key. Finds volumes and their ISBNs.
// https://openlibrary.org/dev/docs/api/search
const SEARCH_URL = "https://openlibrary.org/search.json";
const FIELDS =
  "key,title,isbn,cover_i,author_name,publisher,first_publish_year";
const TIMEOUT_MS = 8000;

// Open Library lists every language edition of a work together. US English
// editions use the 978-0, 978-1 and 979-8 ISBN ranges, so we keep those
const ENGLISH_ISBN = /^(9780|9781|9798)\d{9}$/;

export const isIsbn13 = (value) => /^97[89]\d{10}$/.test(value);

// accepts an ISBN-10 or ISBN-13 (dashes and spaces ignored) and returns ISBN-13
export function toIsbn13(raw) {
  const digits = String(raw).replace(/[\s-]/g, "").toUpperCase();
  if (/^97[89]\d{10}$/.test(digits)) return digits;
  if (!/^\d{9}[\dX]$/.test(digits)) return null;
  const core = "978" + digits.slice(0, 9);
  const sum = [...core].reduce(
    (acc, d, i) => acc + Number(d) * (i % 2 ? 3 : 1),
    0,
  );
  return core + ((10 - (sum % 10)) % 10);
}

const volumeNumber = (title) => {
  const m = title.match(/\bvol(?:ume)?\.?\s*(\d+)/i);
  return m ? Number(m[1]) : null;
};

const toBook = (doc, isbn13) => {
  if (!isbn13 || !doc.title) return null;
  return {
    isbn13,
    title: doc.title,
    authors: doc.author_name?.join(", ") ?? null,
    publisher: doc.publisher?.[0] ?? null,
    year: doc.first_publish_year ?? null,
    volume: volumeNumber(doc.title),
    coverUrl: doc.cover_i
      ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg`
      : `https://covers.openlibrary.org/b/isbn/${isbn13}-M.jpg`,
  };
};

async function search(q, limit, timeoutMs = TIMEOUT_MS) {
  const url = `${SEARCH_URL}?${new URLSearchParams({ q, fields: FIELDS, limit })}`;
  const res = await fetch(url, {
    headers: { "User-Agent": "MangaTracker/1.0 (price checker)" },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`Open Library responded ${res.status}`);
  const { docs } = await res.json();
  return docs;
}

// title / author / series search, or a pasted ISBN. Numbered volumes first,
// in order, then box sets and one-offs
export async function searchVolumes(query, { max = 24, timeoutMs } = {}) {
  const isbn = toIsbn13(query);
  const docs = await search(
    isbn ? `isbn:${isbn}` : query,
    Math.max(40, max * 2),
    timeoutMs,
  );

  const seen = new Set();
  const books = [];
  for (const doc of docs) {
    const book = toBook(
      doc,
      (doc.isbn ?? []).find((i) => ENGLISH_ISBN.test(i)),
    );
    if (!book || seen.has(book.isbn13)) continue;
    seen.add(book.isbn13);
    books.push(book);
  }

  return books
    .sort((a, b) => (a.volume ?? Infinity) - (b.volume ?? Infinity))
    .slice(0, max);
}

export async function lookupIsbn(isbn13) {
  const docs = await search(`isbn:${isbn13}`, 1);
  // the requested ISBN wins even if Open Library lists another edition first
  return docs.length ? toBook(docs[0], isbn13) : null;
}
