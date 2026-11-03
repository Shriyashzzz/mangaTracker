// Open Library: free, no key. Finds volumes and their ISBNs.
// https://openlibrary.org/dev/docs/api/search
import { openLibraryFetch } from "./openLibrary.js";
import { englishSeriesName } from "./anilist.js";
import { coverPath } from "./covers.js";
import { isSingleVolume, normalize, seriesOf } from "../stores/match.js";
import type { CatalogBook } from "../types.js";

const SEARCH_URL = "https://openlibrary.org/search.json";
const FIELDS =
  "key,title,isbn,cover_i,author_name,publisher,first_publish_year";
const TIMEOUT_MS = 8000;

// one search hit, with only the fields we ask for
type Doc = {
  key?: string;
  title?: string;
  isbn?: string[];
  author_name?: string[];
  publisher?: string[];
  first_publish_year?: number;
};

// a converted title, or null; `degraded` = couldn't be translated right now
type TitleResult = { title: string | null; degraded?: boolean };

// Open Library lists every language edition of a work together. US English
// editions use the 978-0, 978-1 and 979-8 ISBN ranges, so we keep those
const ENGLISH_ISBN = /^(9780|9781|9798)\d{9}$/;

export const isIsbn13 = (value: string) => /^97[89]\d{10}$/.test(value);

// accepts an ISBN-10 or ISBN-13 (dashes and spaces ignored) and returns
// the ISBN-13, or null when it isn't one
export function toIsbn13(raw: unknown): string | null {
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
const JAPANESE = /[　-ヿ㐀-鿿＀-￯]/;
const englishTitle = (title: string) =>
  title
    .replace(/\s*[(（][^)）]*[　-ヿ㐀-鿿][^)）]*[)）]/g, "")
    .replace(/[　-ヿ㐀-鿿＀-￯]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

// "Vol. 12", "Volume 12" or a bare trailing number ("... as a Slime 21")
const volumeNumber = (title: string) => {
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
async function translateTitle(japaneseTitle: string): Promise<TitleResult> {
  const number = japaneseTitle.match(/(\d+)\s*$/)?.[1];
  const series = japaneseTitle.replace(/\s*\d+\s*$/, "").trim();
  if (!series) return { title: null };
  try {
    const english = await englishSeriesName(series);
    if (!english) return { title: null };
    return {
      title: number ? `${english}, Vol. ${Number(number)}` : english,
    };
  } catch {
    return { title: null, degraded: true };
  }
}

// Japanese stripped out, or translated when nothing English is left
async function englishOnly(rawTitle: string): Promise<TitleResult> {
  if (LIGHT_NOVEL.test(rawTitle)) return { title: null };
  const untagged = rawTitle.replace(FORMAT_TAG, "").trim();
  if (!JAPANESE.test(untagged)) return { title: untagged };
  const stripped = englishTitle(untagged);
  if (/[a-z]{2}/i.test(stripped)) return { title: stripped };
  return translateTitle(untagged);
}

const toBook = async (
  doc: Doc,
  isbn13: string | undefined,
): Promise<{ book: CatalogBook | null; degraded?: boolean }> => {
  if (!isbn13 || !doc.title) return { book: null };
  const { title, degraded } = await englishOnly(doc.title);
  // no English title even after translating: leave it out
  if (!title) return { book: null, ...(degraded && { degraded }) };
  return {
    book: {
      isbn13,
      title,
      authors: doc.author_name?.join(", ") ?? null,
      publisher: doc.publisher?.[0] ?? null,
      year: doc.first_publish_year ?? null,
      volume: volumeNumber(title),
      // the cover of this exact edition, looked up and cached by our server
      // (see covers.ts). The work's cover (doc.cover_i) can belong to another
      // language edition, or to an unrelated book when Open Library has
      // grouped editions wrongly
      coverUrl: coverPath(isbn13),
    },
  };
};

// Open Library is free but uneven: the same query can take half a second or
// time out. A failed attempt is retried once after a short pause
async function search(
  q: string,
  limit: number,
  timeoutMs = TIMEOUT_MS,
  attempt = 1,
): Promise<Doc[]> {
  const params = new URLSearchParams({
    q,
    fields: FIELDS,
    limit: String(limit),
  });
  try {
    const res = await openLibraryFetch(`${SEARCH_URL}?${params}`, timeoutMs);
    if (!res.ok) throw new Error(`Open Library responded ${res.status}`);
    const { docs } = (await res.json()) as { docs: Doc[] };
    return docs;
  } catch (e) {
    const err = e as Error;
    // a timeout already waited the full time; retrying would double it
    const timedOut = err.name === "TimeoutError" || err.name === "AbortError";
    const clientError = /responded 4\d\d/.test(err.message);
    if (attempt >= 2 || clientError || timedOut) throw e;
    await new Promise((r) => setTimeout(r, 800));
    return search(q, limit, timeoutMs, attempt + 1);
  }
}

// ---------- works that hold a whole series ----------
// Open Library sometimes merges every volume into one work, like "Wistoria" with
// ten English ISBNs and no volume number. Each edition still says which volume
// it is ("Wistoria" + "Wand and Sword 1"), so those are read one by one. A volume
// is only ever numbered from what its own edition says
const EDITIONS_FRESH_MS = 24 * 60 * 60 * 1000;
const MAX_EDITIONS = 200;
// enough for the real work; a common title like "Vagabond" also matches novels
const MAX_MERGED_WORKS = 5;
// a Japanese-titled work per volume
const MAX_JAPANESE_WORKS = 24;

type Edition = {
  title?: string;
  subtitle?: string;
  isbn_13?: string[];
  isbn_10?: string[];
  publishers?: string[];
  languages?: { key?: string }[];
};

// several searches can ask about the same work; failures aren't kept
const editionsCache = new Map<string, { at: number; found: Promise<Edition[]> }>();

function fetchEditions(workKey: string, timeoutMs = TIMEOUT_MS) {
  const hit = editionsCache.get(workKey);
  if (hit && Date.now() - hit.at < EDITIONS_FRESH_MS) return hit.found;
  const found = openLibraryFetch(
    `https://openlibrary.org${workKey}/editions.json?limit=${MAX_EDITIONS}`,
    timeoutMs,
  ).then(async (res) => {
    if (!res.ok) throw new Error(`Open Library responded ${res.status}`);
    const { entries = [] } = (await res.json()) as { entries?: Edition[] };
    return entries;
  });
  editionsCache.set(workKey, { at: Date.now(), found });
  found.catch(() => editionsCache.delete(workKey));
  if (editionsCache.size > 500) {
    editionsCache.delete(editionsCache.keys().next().value!);
  }
  return found;
}

// one work carrying several English editions under this series' own name, with
// nothing in its title saying which volume it is
export function isMergedWork(doc: Doc, seriesName: string) {
  const englishEditions = (doc.isbn ?? []).filter((i) => ENGLISH_ISBN.test(i));
  if (!doc.key || !doc.title || englishEditions.length < 2) return false;
  const title = normalize(doc.title);
  const wanted = normalize(seriesName);
  if (!title) return false;
  const related = wanted.includes(title) || title.includes(wanted);
  return related && (title === wanted || volumeNumber(doc.title) === null);
}

// listed under its Japanese title, which didn't lead back to this series: AniList
// can answer with a spin-off, as it does for 怪獣8号. Its English edition may
// still carry the right name ("Kaiju No. 8, Vol. 1")
export function isUntranslatedWork(
  doc: Doc,
  book: CatalogBook | null,
  seriesName: string,
) {
  if (!doc.key || !doc.title || !JAPANESE.test(doc.title)) return false;
  if (!(doc.isbn ?? []).some((i) => ENGLISH_ISBN.test(i))) return false;
  return !book || seriesOf(book.title) !== seriesOf(seriesName);
}

// ① to ⑳, which some editions use for the volume
const circledToDigits = (text: string) =>
  text.replace(/[①-⑳]/g, (c) => ` ${c.charCodeAt(0) - 0x2460 + 1}`);

// the volumes one merged work's editions name, filed under the series' own name
export function booksFromEditions(
  editions: Edition[],
  doc: Doc,
  seriesName: string,
): CatalogBook[] {
  const wanted = seriesOf(seriesName);
  const whole = normalize(seriesName);
  const books: CatalogBook[] = [];
  for (const edition of editions) {
    const isbn13 = [...(edition.isbn_13 ?? []), ...(edition.isbn_10 ?? [])]
      .map(toIsbn13)
      .find((i) => i && ENGLISH_ISBN.test(i));
    if (!isbn13 || !edition.title) continue;
    const languages = edition.languages ?? [];
    if (languages.length && !languages.some((l) => l.key === "/languages/eng")) {
      continue;
    }
    const full = circledToDigits(
      [edition.title, edition.subtitle].filter(Boolean).join(" "),
    );
    if (LIGHT_NOVEL.test(full) || !isSingleVolume(full)) continue;
    // "Kaiju No. 8" alone is the series, not its eighth volume
    if (normalize(full) === whole) continue;
    const volume = volumeNumber(full);
    if (volume === null) continue;
    // a name ending in a number loses it in seriesOf: "Kaiju No. 8 2"
    if (seriesOf(full) !== wanted && seriesOf(full) !== whole) continue;
    books.push({
      isbn13,
      title: `${seriesName}, Vol. ${volume}`,
      authors: doc.author_name?.join(", ") ?? null,
      publisher: edition.publishers?.[0] ?? doc.publisher?.[0] ?? null,
      year: doc.first_publish_year ?? null,
      volume,
      coverUrl: coverPath(isbn13),
    });
  }
  return books;
}

// title / author / series search, or a pasted ISBN. Numbered volumes first,
// in order, then box sets and one-offs. `degraded` says the answer may be
// missing volumes because a title couldn't be translated right now
export async function searchVolumesDetailed(
  query: string,
  {
    max = 24,
    timeoutMs,
    seriesName,
  }: {
    max?: number;
    timeoutMs?: number;
    // looking for this series' volumes: also read inside works that merge them
    seriesName?: string;
  } = {},
): Promise<{ books: CatalogBook[]; degraded: boolean }> {
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
  const seen = new Set<string>();
  const books: CatalogBook[] = [];
  let degraded = false;
  for (const { book, degraded: d } of candidates) {
    degraded ||= Boolean(d);
    if (!book || seen.has(book.isbn13)) continue;
    seen.add(book.isbn13);
    books.push(book);
  }

  if (seriesName) {
    const toRead = [
      ...docs
        .filter((doc) => isMergedWork(doc, seriesName))
        .slice(0, MAX_MERGED_WORKS),
      ...docs
        .filter((doc, i) =>
          isUntranslatedWork(doc, candidates[i]!.book, seriesName),
        )
        .slice(0, MAX_JAPANESE_WORKS),
    ];
    const editions = await Promise.allSettled(
      toRead.map((doc) => fetchEditions(doc.key!, timeoutMs)),
    );
    editions.forEach((result, i) => {
      // a volume list that may be short, not a finished answer
      if (result.status === "rejected") {
        degraded = true;
        return;
      }
      for (const book of booksFromEditions(result.value, toRead[i]!, seriesName)) {
        // the search result for this ISBN may be the work's numberless title
        const same = books.findIndex((b) => b.isbn13 === book.isbn13);
        if (same === -1) books.push(book);
        else if (books[same]!.volume === null) books[same] = book;
      }
    });
  }

  return {
    books: books
      .sort((a, b) => (a.volume ?? Infinity) - (b.volume ?? Infinity))
      .slice(0, max),
    degraded,
  };
}

export const searchVolumes = async (
  query: string,
  options?: { max?: number; timeoutMs?: number },
) => (await searchVolumesDetailed(query, options)).books;

export async function lookupIsbn(isbn13: string): Promise<CatalogBook | null> {
  const docs = await search(`isbn:${isbn13}`, 1);
  // the requested ISBN wins even if Open Library lists another edition first
  return docs[0] ? (await toBook(docs[0], isbn13)).book : null;
}
