// Open Library: free, no key. Finds volumes and their ISBNs.
// https://openlibrary.org/dev/docs/api/search
import { saysMoreThan, titleOfRecord, withEditionOf } from "./editionTitle.js";
import { editionNameOf } from "../../util/shelf/editionNames.js";
import { googleRecordOf } from "./googleBooksCatalog.js";
import { openLibraryFetch } from "./openLibrary.js";
import { englishSeriesName } from "./anilist.js";
import { coverPath } from "./covers.js";
import { publisherOf } from "../publishers.js";
import {
  bookNumberOf,
  isSingleVolume,
  normalize,
  seriesOf,
} from "../stores/match.js";
import { baseName, isNovelName, novelName } from "../lightNovel.js";
import type { CatalogBook } from "../types.js";

const SEARCH_URL = "https://openlibrary.org/search.json";
// (editions: the one edition of the work the search matched, with its own
// ISBNs and format, for telling the printed book from the eBook)
const FIELDS =
  "key,title,isbn,cover_i,author_name,publisher,first_publish_year,subject,number_of_pages_median,editions,editions.isbn,editions.format";
const TIMEOUT_MS = 8000;

// the author names in English letters: a Japanese work lists both
// ("丸山くがね, Kugane Maruyama"), and readers here get the English one
export const englishAuthors = (names: string[] | undefined) => {
  const english = (names ?? []).filter((n) => !/[\u3000-ヿ㐀-鿿＀-￯]/.test(n));
  // a name the catalog lists twice ("Tatsuki Fujimoto, Judit Moreno,
  // Tatsuki Fujimoto") is said once
  const once = english.filter(
    (name, i) =>
      english.findIndex(
        (other) => other.trim().toLowerCase() === name.trim().toLowerCase(),
      ) === i,
  );
  return once.length ? once.join(", ") : null;
};

// one search hit, with only the fields we ask for
type Doc = {
  key?: string;
  title?: string;
  isbn?: string[];
  author_name?: string[];
  publisher?: string[];
  first_publish_year?: number;
  subject?: string[];
  number_of_pages_median?: number;
  // the edition the search matched: its ISBNs, and "Paperback" or "eBook"
  editions?: { docs?: { isbn?: string[]; format?: string[] }[] };
};

// a converted title, or null; `degraded` = couldn't be translated right now
type TitleResult = { title: string | null; degraded?: boolean };

// Open Library lists every language edition of a work together. US English
// editions use the 978-0, 978-1 and 979-8 ISBN ranges, so we keep those
const ENGLISH_ISBN = /^(9780|9781|9798)\d{9}$/;

// The ISBN a work is listed under. A work's own list mixes every edition's,
// the eBook's among them, and its first English one was often the eBook's
// (Hunter x Hunter 13 and 27), which no store prices. So the edition the
// search matched is asked first: its ISBN when it's a printed book, and the
// work's first English one only when that says nothing
const SAYS_EBOOK = /e-?book/i;
// the edition the search matched, when it's the eBook: its ISBNs
const ebookIsbnsOf = (doc: Doc) => {
  const matched = doc.editions?.docs?.[0];
  return (matched?.format ?? []).some((f) => SAYS_EBOOK.test(f))
    ? new Set(matched?.isbn ?? [])
    : null;
};
export function isbnToListUnder(doc: Doc) {
  const english = (doc.isbn ?? []).filter((i) => ENGLISH_ISBN.test(i));
  const ebook = ebookIsbnsOf(doc);
  // the matched edition is the eBook: another English ISBN of the work is
  // the book's (the eBook's own only when the work has no other)
  if (ebook) return english.find((i) => !ebook.has(i)) ?? english[0];
  const matched = doc.editions?.docs?.[0];
  return (matched?.isbn ?? []).find((i) => ENGLISH_ISBN.test(i)) ?? english[0];
}
// whether the ISBN a work was listed under is its eBook's after all
export const listedAsEbook = (doc: Doc, isbn13: string | undefined) =>
  Boolean(isbn13 && ebookIsbnsOf(doc)?.has(isbn13));

export const isIsbn13 = (value: string) => /^97[89]\d{10}$/.test(value);

// an ISBN-13 whose last digit checks out: a typo in one digit fails it, so a
// book saved with it would never match a real book or its price
export function isbn13Ok(value: string | null | undefined): boolean {
  if (!value || !isIsbn13(value)) return false;
  const sum = [...value]
    .slice(0, 12)
    .reduce((acc, d, i) => acc + Number(d) * (i % 2 ? 3 : 1), 0);
  return (10 - (sum % 10)) % 10 === Number(value[12]);
}

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
// in the US, so keep the English part only. Korean too: a manhwa's first
// volume can be filed as "나 혼자만 레벨업 1 (comic)"
const JAPANESE = /[\u3000-ヿ㐀-鿿＀-￯가-힯ᄀ-ᇿ]/;
const englishTitle = (title: string) =>
  title
    .replace(/\s*[(（][^)）]*[\u3000-ヿ㐀-鿿가-힯][^)）]*[)）]/g, "")
    .replace(/[\u3000-ヿ㐀-鿿＀-￯가-힯ᄀ-ᇿ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

// "Vol. 12", "Volume 12" or a bare trailing number ("... as a Slime 21")
const volumeNumber = (title: string) => {
  const m =
    title.match(/\bvol(?:ume)?\.?\s*(\d+)/i) ?? title.match(/\s(\d{1,3})\s*$/);
  return m ? Number(m[1]) : null;
};

// catalog titles often tag the format: "(manga)", "(light novel)". The manga tag
// is dropped; a light novel becomes a volume of the novel series, named apart
// from the manga's (see lightNovel.ts)
const LIGHT_NOVEL = /\(\s*(light\s*novel|novel|ln)\s*\)|\blight novel\b/i;
const LIGHT_NOVEL_TAGS = /\(\s*(light\s*novel|novel|ln)\s*\)|\blight novel\b/gi;

// Open Library's titles mostly don't say "(light novel)", but the work does: a
// subject like "series:オーバーロード (light novel)" or "Light novels", or a
// novel imprint as publisher (Yen On is Yen Press's novels, Airship Seven
// Seas'). Without this the manga's page listed the novel's volumes
// Only subjects that say the book is one ("Light novels", "series:オーバーロード
// (light novel)"), not ones about them: a manga adaptation can carry
// "Adaptations of light novels". A work's publishers can mix the manga's and
// the novel's when Open Library has grouped editions together, so a novel
// imprint only counts when the manga imprint isn't there too
const NOVEL_SUBJECT =
  /^light\s*novels?(\s*[,(]|$)|\(\s*light\s*novel\s*\)\s*$/i;
const NOVEL_IMPRINT = /^(yen on|j-novel club|airship|cross infinite world)\b/i;
const MANGA_IMPRINT = /^yen press\b/i;
export const isNovelEdition = (
  title: string,
  subjects: string[] = [],
  publishers: string[] = [],
) =>
  LIGHT_NOVEL.test(title) ||
  subjects.some((s) => NOVEL_SUBJECT.test(s.trim())) ||
  (publishers.some((p) => NOVEL_IMPRINT.test(p.trim())) &&
    !publishers.some((p) => MANGA_IMPRINT.test(p.trim())));

// "Overlord, Vol. 3 (light novel): The Bloody Valkyrie" ->
// "Overlord Light Novel, Vol. 3"
// the record says it's a comic: "Solo Leveling, Vol. 5 (comic)", "(manga)", or
// a subject like "series:나 혼자만 레벨업 (comic)". A manhwa in full colour runs
// 300+ pages, as long as a novel, so length never makes one of these a novel
const COMIC_SUBJECT = /\(\s*(comic|manga|manhwa|manhua)\s*\)\s*$/i;
// Or says so among other words in its brackets: Seven Seas' Chinese comics
// are "(The Comic / Manhua)" and "(The Comic)". Missed, their volumes of
// 230 pages and up were taken for the novel's
const COMIC_IN_BRACKETS = /\([^)]*\b(comic|manga|manhwa|manhua)\b[^)]*\)/i;
export const saysComic = (title: string, subjects: string[] = []) =>
  new RegExp(FORMAT_TAG.source, "i").test(title) ||
  COMIC_IN_BRACKETS.test(title) ||
  subjects.some((s) => COMIC_SUBJECT.test(s.trim()));

// Open Library mostly writes the number before the volume's own subtitle:
// "Sword Art Online 9 (light novel): Alicization Beginning". "Vol. 3"
// anywhere wins; otherwise the number before a ":" or " - ", or at the end.
// Not handled: series numbered by part ("Ascendance of a Bookworm: Part 1
// Volume 3"), whose volume numbers start again each part. They read as their
// own "…: Part 1" series, which no shelf entry is named, so they're left out
// rather than filed under the wrong number
export const novelSeriesAndVolume = (raw: string) => {
  const title = raw
    .replace(LIGHT_NOVEL_TAGS, " ")
    .replace(/\s+/g, " ")
    // "Sword Art Online Progressive 2 - light novel" leaves a dash behind
    .replace(/[\s,:;\-–—]+$/, "")
    .trim();
  const vol = title.match(/^(.*?)[,\s]*\bvol(?:ume)?\.?\s*(\d+)/i);
  const numbered =
    vol ?? title.match(/^(.*?\S)\s+0*(\d{1,3})\s*(?::|\s[-–—]\s|\[|$)/);
  // as written: seriesName would drop the 1 of "Part 1"
  const series = (numbered ? numbered[1]! : title)
    .replace(/\(.*?\)/g, " ")
    .replace(/\s+/g, " ")
    // a separator, not Re:ZERO's own closing "-"
    .replace(/(\s+[-–—])?[\s,:;]*$/, "")
    .trim();
  return { series, volume: numbered ? Number(numbered[2]) : null };
};

const asNovelTitle = (title: string) => {
  const { series, volume } = novelSeriesAndVolume(title);
  if (!/[a-z]{2}/i.test(series)) return null;
  return `${novelName(series)}${volume != null ? `, Vol. ${volume}` : ""}`;
};
const FORMAT_TAG = /\s*\(\s*(manga|comic|graphic novel)\s*\)/gi;

// a US edition listed only under its Japanese title, like "葬送のフリーレン 12":
// look up the official English series name and rebuild "Name, Vol. 12"
// "オーバーロード15 半森妖精の神人 ［上］": the series is what comes before the
// number, so every volume asks AniList the same short question (asked once)
// rather than one question per subtitle. A novel is asked as a novel: the
// manga search can answer with a manga spin-off's name
async function translateTitle(
  japaneseTitle: string,
  novel = false,
): Promise<TitleResult> {
  // "ヴィンランド・サガ 17‐18" is one book holding two volumes: its editions
  // say which book (booksFromEditions), so it's never read as volume 18
  if (volumeRange(japaneseTitle)) return { title: null };
  const trailing = japaneseTitle.match(/^(.*?)\s*(\d+)\s*$/);
  const split = trailing ?? japaneseTitle.match(/^(\D+?)\s*(\d{1,3})(?!\d)/);
  const number = split?.[2];
  const series = (split ? split[1]! : japaneseTitle).trim();
  if (!series) return { title: null };
  try {
    const english = await englishSeriesName(series, novel);
    if (!english) return { title: null };
    return {
      title: number ? `${english}, Vol. ${Number(number)}` : english,
    };
  } catch {
    return { title: null, degraded: true };
  }
}

// Japanese stripped out, or translated when nothing English is left
async function englishOnly(
  rawTitle: string,
  novel = LIGHT_NOVEL.test(rawTitle),
): Promise<TitleResult> {
  const untagged = rawTitle
    .replace(novel ? LIGHT_NOVEL_TAGS : FORMAT_TAG, " ")
    .replace(FORMAT_TAG, " ")
    .replace(/\s+/g, " ")
    .trim();
  const english = await englishPart(untagged, novel);
  if (!novel || !english.title) return english;
  return { ...english, title: asNovelTitle(english.title) };
}

async function englishPart(
  untagged: string,
  novel = false,
): Promise<TitleResult> {
  if (!JAPANESE.test(untagged)) return { title: untagged };
  const stripped = englishTitle(untagged);
  if (/[a-z]{2}/i.test(stripped)) return { title: stripped };
  return translateTitle(untagged, novel);
}

// a book only self-publishers ever put out: fan notebooks, colouring books
// and planners that borrow a series' name ("Vinland Saga Vol. 11" was a
// notebook), never the manga itself, which a real publisher prints
const SELF_PUBLISHED = /^(independently published|createspace)/i;
export const isSelfPublished = (publishers: string[] = []) =>
  publishers.length > 0 &&
  publishers.every((p) => SELF_PUBLISHED.test(p.trim()));

const toBook = async (
  doc: Doc,
  isbn13: string | undefined,
): Promise<{ book: CatalogBook | null; degraded?: boolean }> => {
  if (!isbn13 || !doc.title) return { book: null };
  const { title, degraded } = await englishOnly(
    doc.title,
    isNovelEdition(doc.title, doc.subject, doc.publisher),
  );
  // no English title even after translating: leave it out
  if (!title) return { book: null, ...(degraded && { degraded }) };
  return {
    book: {
      isbn13,
      title,
      authors: englishAuthors(doc.author_name),
      publisher: publisherOf(isbn13, { work: doc.publisher }),
      year: doc.first_publish_year ?? null,
      volume: volumeNumber(title),
      pages: doc.number_of_pages_median ?? null,
      ...(saysComic(doc.title, doc.subject) ? { comic: true } : {}),
      // the cover of this exact edition, looked up and cached by our server
      // (see covers.ts). The work's cover (doc.cover_i) can belong to another
      // language edition, or to an unrelated book when Open Library has
      // grouped editions wrongly
      coverUrl: coverPath(isbn13),
    },
  };
};

// a book another catalog listed (Google Books), held to the same rules as
// Open Library's: an English edition, not self-published, its title in
// English, a light novel named as the novel's
export async function bookFromListing(listing: {
  isbn13: string;
  title: string;
  authors?: string[];
  publisher?: string | null;
  year?: number | null;
  pages?: number | null;
  published?: string | null;
}): Promise<CatalogBook | null> {
  const publishers = listing.publisher ? [listing.publisher] : [];
  if (!ENGLISH_ISBN.test(listing.isbn13) || isSelfPublished(publishers))
    return null;
  const { title } = await englishOnly(
    listing.title,
    isNovelEdition(listing.title, [], publishers),
  );
  if (!title) return null;
  return {
    isbn13: listing.isbn13,
    title,
    authors: englishAuthors(listing.authors),
    publisher: publisherOf(listing.isbn13, { edition: publishers }),
    year: listing.year ?? null,
    volume: volumeNumber(title),
    pages: listing.pages ?? null,
    ...(saysComic(listing.title) ? { comic: true } : {}),
    coverUrl: coverPath(listing.isbn13),
    ...(listing.published ? { published: listing.published } : {}),
  };
}

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
// a Japanese-titled work holding two or three volumes in one English book:
// "ヴィンランド・サガ 17‐18". A wider range is a box of separate books
const RANGE = /(\d{1,3})\s*[‐\-–~〜]\s*(\d{1,3})\s*$/;
export const volumeRange = (title: string) => {
  if (!JAPANESE.test(title)) return null;
  const m = title.match(RANGE);
  if (!m) return null;
  const from = Number(m[1]);
  const to = Number(m[2]);
  return to > from && to - from <= 2 ? { from, to } : null;
};

// "Vinland Saga, Book Nine" -> "Vinland Saga, Book 9", the way stores and
// bookNumberOf read it
const ONES = [
  "",
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "ten",
  "eleven",
  "twelve",
  "thirteen",
  "fourteen",
  "fifteen",
  "sixteen",
  "seventeen",
  "eighteen",
  "nineteen",
];
const TENS: Record<string, number> = { twenty: 20, thirty: 30, forty: 40 };
const wordNumber = (word: string) => {
  const [tens, ones = ""] = word.toLowerCase().split(/[-\s]+/);
  if (ONES.includes(tens!) && !ones) return ONES.indexOf(tens!) || null;
  if (TENS[tens!] == null) return null;
  const unit = ones ? ONES.indexOf(ones) : 0;
  return unit < 0 || unit > 9 ? null : TENS[tens!]! + unit;
};
export const withBookDigits = (title: string) =>
  title.replace(
    /,?\s*\bbook\s+([a-z]+(?:[-\s][a-z]+)?)\s*$/i,
    (whole, word: string) => {
      const n = wordNumber(word);
      return n ? `, Book ${n}` : whole;
    },
  );

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
  physical_format?: string;
  subtitle?: string;
  // the publisher's note on which edition it is: "Omnibus Edition"
  edition_name?: string;
  isbn_13?: string[];
  isbn_10?: string[];
  publishers?: string[];
  languages?: { key?: string }[];
  number_of_pages?: number;
};

// several searches can ask about the same work; failures aren't kept
const editionsCache = new Map<
  string,
  { at: number; found: Promise<Edition[]> }
>();

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
  const title = normalize(doc.title.replace(LIGHT_NOVEL_TAGS, " "));
  const wanted = normalize(baseName(seriesName));
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

// an edition's English ISBN-13, from either of its ISBN lists
const englishIsbnOf = (edition: Edition) =>
  [...(edition.isbn_13 ?? []), ...(edition.isbn_10 ?? [])]
    .map(toIsbn13)
    .find((isbn) => isbn && ENGLISH_ISBN.test(isbn));

// one book holding a few volumes ("Vinland Saga, Book 9", vols. 17 and 18):
// each volume is listed with the book's ISBN. The printed edition is taken
// rather than the ebook
function volumesOfOneBook(
  editions: Edition[],
  doc: Doc,
  seriesName: string,
  range: { from: number; to: number },
): CatalogBook[] {
  const wanted = seriesOf(baseName(seriesName));
  const english = editions
    .map((edition) => ({
      edition,
      isbn13: englishIsbnOf(edition),
      title: withBookDigits((edition.title ?? "").trim()),
    }))
    .filter(({ edition, isbn13, title }) => {
      const inAnotherLanguage = (edition.languages ?? []).some(
        (l) => l.key && l.key !== "/languages/eng",
      );
      return (
        isbn13 &&
        !inAnotherLanguage &&
        bookNumberOf(title) !== null &&
        seriesOf(title) === wanted
      );
    });
  const isEbook = (edition: Edition) =>
    /e-?book/i.test(edition.physical_format ?? "");
  const print = english.find(({ edition }) => !isEbook(edition)) ?? english[0];
  if (!print) return [];

  const isbn13 = print.isbn13!;
  const book = bookNumberOf(print.title)!;
  const books: CatalogBook[] = [];
  for (let volume = range.from; volume <= range.to; volume++) {
    books.push({
      isbn13,
      title: `${seriesName}, Book ${book}`,
      authors: englishAuthors(doc.author_name),
      publisher: publisherOf(isbn13, {
        edition: print.edition.publishers,
        work: doc.publisher,
      }),
      year: doc.first_publish_year ?? null,
      volume,
      coverUrl: coverPath(isbn13),
      pages: print.edition.number_of_pages ?? null,
      comic: true,
      inBook: { book, from: range.from, to: range.to },
    });
  }
  return books;
}

// one edition as a volume of the series, or null when it isn't one: not in
// English, the other format (a novel when the manga is asked for), a set, or
// naming another series
function volumeFromEdition(
  edition: Edition,
  doc: Doc,
  seriesName: string,
): CatalogBook | null {
  const isbn13 = englishIsbnOf(edition);
  if (!isbn13 || !edition.title) return null;
  const languages = edition.languages ?? [];
  const saysAnotherLanguage =
    languages.length > 0 && !languages.some((l) => l.key === "/languages/eng");
  if (saysAnotherLanguage) return null;

  // the novel series takes only the novel editions, named as the novel's
  const wantsNovel = isNovelName(seriesName);
  const tagged = circledToDigits(
    [edition.title, edition.subtitle].filter(Boolean).join(" "),
  );
  const isNovel = isNovelEdition(
    tagged,
    doc.subject,
    edition.publishers ?? doc.publisher,
  );
  if (isNovel !== wantsNovel || !isSingleVolume(tagged)) return null;

  const full = tagged
    .replace(LIGHT_NOVEL_TAGS, " ")
    .replace(/\s+/g, " ")
    .trim();
  const seriesWhole = normalize(baseName(seriesName));
  // "Kaiju No. 8" alone is the series, not its eighth volume
  if (normalize(full) === seriesWhole) return null;
  // a novel's "Sword Art Online 9: Alicization Beginning" reads as 9
  const parsed = wantsNovel ? novelSeriesAndVolume(full) : null;
  const volume = parsed ? parsed.volume : volumeNumber(full);
  if (volume === null) return null;
  // a name ending in a number loses it in seriesOf: "Kaiju No. 8 2"
  const named = parsed ? seriesOf(parsed.series) : seriesOf(full);
  const wanted = seriesOf(baseName(seriesName));
  if (named !== wanted && named !== seriesWhole) return null;

  return {
    isbn13,
    title: `${seriesName}, Vol. ${volume}`,
    authors: englishAuthors(doc.author_name),
    publisher: publisherOf(isbn13, {
      edition: edition.publishers,
      work: doc.publisher,
    }),
    year: doc.first_publish_year ?? null,
    volume,
    coverUrl: coverPath(isbn13),
    pages: edition.number_of_pages ?? null,
    ...(saysComic(tagged, doc.subject) ? { comic: true } : {}),
    ...(/e-?book/i.test(edition.physical_format ?? "") ? { ebook: true } : {}),
  };
}

// the volumes one merged work's editions name, filed under the series' own name
export function booksFromEditions(
  editions: Edition[],
  doc: Doc,
  seriesName: string,
): CatalogBook[] {
  // a work that is one book of several volumes (never for a novel series)
  const range =
    !isNovelName(seriesName) && doc.title ? volumeRange(doc.title) : null;
  if (range) return volumesOfOneBook(editions, doc, seriesName, range);

  // The printed book of each volume, and its digital edition only when
  // there's no printed one here: a work's editions list both, and the
  // eBook's ISBN isn't the one any store prices (Hunter x Hunter 13 and 27
  // were listed under theirs)
  const isEbook = (edition: Edition) =>
    /e-?book/i.test(edition.physical_format ?? "");
  const books: CatalogBook[] = [];
  const printed = new Set<number | null>();
  for (const edition of editions.filter((e) => !isEbook(e))) {
    const book = volumeFromEdition(edition, doc, seriesName);
    if (!book) continue;
    books.push(book);
    printed.add(book.volume);
  }
  for (const edition of editions.filter(isEbook)) {
    const book = volumeFromEdition(edition, doc, seriesName);
    if (book && !printed.has(book.volume)) books.push(book);
  }
  return books;
}

// adds a volume read from a work's editions to the search's books. The
// search may already hold this ISBN as the work's numberless title: the
// numbered one takes its place. A book holding two volumes is listed once
// for each volume, under the same ISBN
function addEditionBook(books: CatalogBook[], book: CatalogBook) {
  const same = books.findIndex(
    (b) =>
      b.isbn13 === book.isbn13 &&
      (b.volume === null || b.volume === book.volume),
  );
  if (same === -1) books.push(book);
  else if (books[same]!.volume === null) books[same] = book;
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
  // a series' volumes leave out what only self-publishers printed (and so
  // never read a notebook's editions). A book looked up by its own ISBN,
  // like a scanned indie one, is still found
  const docs = (
    await search(
      isbn ? `isbn:${isbn}` : query,
      Math.max(40, max * 2),
      timeoutMs,
    )
  ).filter((doc) => isbn || !isSelfPublished(doc.publisher));

  const candidates = await Promise.all(
    docs.map((doc) =>
      toBook(doc, isbnToListUnder(doc)).then((made) =>
        // only its eBook to go on: marked, so a printed copy found any
        // other way takes its place
        made.book && listedAsEbook(doc, made.book.isbn13)
          ? { ...made, book: { ...made.book, ebook: true as const } }
          : made,
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
    // works worth opening for their editions: ones that merge several
    // volumes under the series' name, and ones listed under a Japanese title
    const merged = docs
      .filter((doc) => isMergedWork(doc, seriesName))
      .slice(0, MAX_MERGED_WORKS);
    const untranslated = docs
      .filter((doc, i) =>
        isUntranslatedWork(doc, candidates[i]!.book, seriesName),
      )
      .slice(0, MAX_JAPANESE_WORKS);
    const toRead = [...merged, ...untranslated];
    const editions = await Promise.allSettled(
      toRead.map((doc) => fetchEditions(doc.key!, timeoutMs)),
    );
    editions.forEach((result, i) => {
      // a volume list that may be short, not a finished answer
      if (result.status === "rejected") {
        degraded = true;
        return;
      }
      const found = booksFromEditions(result.value, toRead[i]!, seriesName);
      for (const book of found) addEditionBook(books, book);
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

// Open Library can hold one ISBN under two records, one a reader's typo
// with no volume ("One Pice Ace's Story THE MANGA") and one the series'
// own ("ONE PIECE EPISODE A 1"): the one that names a volume is the one a
// series can be found from
const RECORDS_FOR_AN_ISBN = 3;
const namesAVolume = (title: string | undefined) =>
  Boolean(title && /(\bvol(ume)?\.?\s*\d+|\s\d{1,3})\s*$/i.test(title));

export async function lookupIsbn(isbn13: string): Promise<CatalogBook | null> {
  const docs = await search(`isbn:${isbn13}`, RECORDS_FOR_AN_ISBN);
  const doc = docs.find((d) => namesAVolume(d.title)) ?? docs[0];
  // the requested ISBN wins even if Open Library lists another edition first
  const { book, degraded } = doc
    ? await toBook(doc, isbn13)
    : { book: null, degraded: false };

  // The ISBN's own record: a search answers with the work's title, which for
  // an edition's book is bare ("Monster"), Japanese, or names no edition
  // ("Dragon Ball Z, Vol. 1" for the VIZBIG). Its own record says the rest
  // (sources/editionTitle.ts). A record that can't be read leaves the title
  // as it was
  // (without one, it fails only where it always did: a book holding a few
  // volumes filed under a Japanese title, which has no other way to be read)
  const record = await ownRecord(isbn13).catch((e: Error) => {
    if (!book && doc?.title && volumeRange(doc.title)) throw e;
    return null;
  });
  const said = record ? titleOfRecord(record) : null;
  const recordTitle =
    said && !JAPANESE.test(said) ? withBookDigits(said) : null;

  if (book) {
    let title = book.title;
    if (recordTitle && saysMoreThan(recordTitle, title))
      // a title that names its volume keeps what it says and gains the
      // edition; a bare one ("Monster") is replaced by the record's
      title = namesItsVolume(title)
        ? withEditionOf(title, recordTitle)
        : recordTitle;
    // Open Library names no edition, but the book is as long as three
    // volumes (or has no number at all): its publisher's own listing, on
    // Google Books, is asked once (a Rurouni Kenshin 3-in-1 that Open
    // Library files as plain "Vol. 1")
    const pages = record?.number_of_pages ?? book.pages ?? 0;
    const looksLikeMore = pages >= OMNIBUS_PAGES || !namesItsVolume(title);
    if (!editionNameOf(title) && looksLikeMore) {
      const listed = await googleTitleOf(isbn13);
      if (listed && saysMoreThan(listed, title))
        title = namesItsVolume(title) ? withEditionOf(title, listed) : listed;
    }
    return title === book.title ? book : { ...book, title };
  }

  // no book from the search. Its own record can still name it: a book
  // holding a few volumes filed under the Japanese title ("Vinland Saga, Book
  // Nine"), or an edition's ("Fullmetal Alchemist: 3-in-1 Edition, Vol. 1").
  // Only a numbered book or a named edition from a manga publisher: any
  // other book stays "we don't know this as a manga"
  const publisher = publisherOf(isbn13, {
    edition: record?.publishers,
    work: doc?.publisher,
  });
  const worthKeeping = (title: string | null): title is string =>
    title !== null &&
    (bookNumberOf(title) !== null ||
      (publisher !== null &&
        (editionNameOf(title) !== null || /\bbox(ed)?\s*set\b/i.test(title))));
  // then its publisher's listing on Google Books, for a manga publisher's
  // ISBN Open Library can't name
  const named = worthKeeping(recordTitle)
    ? recordTitle
    : publisher !== null
      ? await googleTitleOf(isbn13)
      : null;
  if (!worthKeeping(named)) {
    // a Japanese title that couldn't be translated right now (AniList
    // down): an outage, never "no such book"
    if (degraded) throw new Error("catalog degraded: title not translated");
    return null;
  }
  return {
    isbn13,
    title: named,
    authors: englishAuthors(doc?.author_name),
    publisher,
    year: doc?.first_publish_year ?? null,
    // the book's number isn't a volume's
    volume: null,
    coverUrl: coverPath(isbn13),
    pages: record?.number_of_pages ?? null,
    comic: true,
  };
}

// a manga volume runs to about 250 pages; a book this long holds three
const OMNIBUS_PAGES = 500;
// "Vol. 3" or a number ending the title, read before any brackets after it
const namesItsVolume = (title: string) =>
  namesAVolume(title.replace(/\s*\(.*\)\s*$/, ""));

// its title as its publisher listed it on Google Books; null when Google
// has nothing in English (or no key, or the day's lookups are used up)
async function googleTitleOf(isbn13: string) {
  const listed = await googleRecordOf(isbn13).catch(() => null);
  const said = listed ? titleOfRecord(listed) : null;
  return said && !JAPANESE.test(said) ? withBookDigits(said) : null;
}

// A book's full title from its own record, in English; null when it has no
// record, or the record is Japanese too. Never throws: for the edition
// lines, which read the records of books a search filed under Japanese
// titles (editionSource.ts)
export async function ownTitleOf(isbn13: string): Promise<string | null> {
  const record = await ownRecord(isbn13).catch(() => null);
  const said = record ? titleOfRecord(record) : null;
  return said && !JAPANESE.test(said) ? withBookDigits(said) : null;
}
export const isJapaneseTitle = (title: string) => JAPANESE.test(title);

// Open Library's own record for an ISBN; null when it has none. Unreachable
// or failing: thrown, never read as "no such book"
async function ownRecord(isbn13: string): Promise<Edition | null> {
  const res = await openLibraryFetch(
    `https://openlibrary.org/isbn/${isbn13}.json`,
    TIMEOUT_MS,
  );
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Open Library responded ${res.status}`);
  return (await res.json()) as Edition;
}
