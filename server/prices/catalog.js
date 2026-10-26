// Open Library: free, no key. Finds volumes and their ISBNs.
// https://openlibrary.org/dev/docs/api/search
import { englishSeriesName } from "./anilist.js";

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

// Open Library sometimes puts the Japanese title alongside the English one,
// e.g. "Jujutsu Kaisen, Vol. 2 (呪術廻戦 Jujutsu Kaisen #2)". Our readers are
// in the US, so keep the English part only
const JAPANESE = /[\u3000-\u30ff\u3400-\u9fff\uff00-\uffef]/;
const englishTitle = (title) =>
  title
    .replace(/\s*[(（][^)）]*[\u3000-\u30ff\u3400-\u9fff][^)）]*[)）]/g, "")
    .replace(/[\u3000-\u30ff\u3400-\u9fff\uff00-\uffef]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

// "Vol. 12", "Volume 12" or a bare trailing number ("... as a Slime 21")
const volumeNumber = (title) => {
  const m =
    title.match(/\bvol(?:ume)?\.?\s*(\d+)/i) ?? title.match(/\s(\d{1,3})\s*$/);
  return m ? Number(m[1]) : null;
};

// catalog titles often tag the format: "(manga)", "(light novel)". We price
// manga, so light novels are left out and the manga tag is dropped
const LIGHT_NOVEL = /\(\s*(light\s*novel|novel|ln)\s*\)|\blight novel\b/i;
const FORMAT_TAG = /\s*\(\s*(manga|comic|graphic novel)\s*\)/gi;

// a US edition listed only under its Japanese title, like "葬送のフリーレン 12":
// look up the official English series name and rebuild "Name, Vol. 12"
async function translateTitle(japaneseTitle) {
  const number = japaneseTitle.match(/(\d+)\s*$/)?.[1];
  const series = japaneseTitle.replace(/\s*\d+\s*$/, "").trim();
  const english = series && (await englishSeriesName(series));
  if (!english) return null;
  return number ? `${english}, Vol. ${Number(number)}` : english;
}

// Japanese stripped out, or translated when nothing English is left
async function englishOnly(rawTitle) {
  if (LIGHT_NOVEL.test(rawTitle)) return null;
  const untagged = rawTitle.replace(FORMAT_TAG, "").trim();
  if (!JAPANESE.test(untagged)) return untagged;
  const stripped = englishTitle(untagged);
  if (/[a-z]{2}/i.test(stripped)) return stripped;
  return translateTitle(untagged);
}

const toBook = async (doc, isbn13) => {
  if (!isbn13 || !doc.title) return null;
  const title = await englishOnly(doc.title);
  // no English title even after translating: leave it out
  if (!title) return null;
  return {
    isbn13,
    title,
    authors: doc.author_name?.join(", ") ?? null,
    publisher: doc.publisher?.[0] ?? null,
    year: doc.first_publish_year ?? null,
    volume: volumeNumber(title),
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

  const candidates = await Promise.all(
    docs.map((doc) =>
      toBook(
        doc,
        (doc.isbn ?? []).find((i) => ENGLISH_ISBN.test(i)),
      ),
    ),
  );
  const seen = new Set();
  const books = [];
  for (const book of candidates) {
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
