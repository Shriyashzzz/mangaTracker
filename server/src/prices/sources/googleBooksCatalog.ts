// Google Books, as a second catalog. It lists books from publishers' own
// data, months before they ship, where Open Library mostly adds a book once
// libraries have it (I See You, Aizawa-san! Vol. 1, out 2027, isn't there).
// So it fills the gaps Open Library leaves: new and upcoming volumes, and
// series Open Library doesn't know yet. Needs GOOGLE_BOOKS_API_KEY (1,000
// free lookups a day; series lists are saved, so it's asked rarely). Without
// one it finds nothing
import { noteCall } from "../callLog.js";
import config from "../../config/config.js";
import { baseName } from "../lightNovel.js";
import { bookFromListing } from "./catalog.js";
import type { CatalogBook } from "../types.js";
import {
  saveVolumeDetails,
  type VolumeDetails,
} from "../../models/volumeDetails.js";

const URL = "https://www.googleapis.com/books/v1/volumes";
const PAGE = 40;
// two pages: a long runner's 100+ volumes are mostly Open Library's already
const PAGES = 2;

type Item = {
  volumeInfo?: {
    title?: string;
    subtitle?: string;
    authors?: string[];
    publisher?: string;
    publishedDate?: string;
    pageCount?: number;
    language?: string;
    // the publisher's description, as HTML
    description?: string;
    industryIdentifiers?: { type: string; identifier: string }[];
  };
  // whether this record is the digital edition, sold to read on a screen
  saleInfo?: { isEbook?: boolean };
};

// "Frieren: Beyond Journey's End" -> "intitle:Frieren intitle:Beyond …"
const titleWords = (name: string) =>
  name
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}\s]+/gu, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1)
    .map((w) => `intitle:${w}`)
    .join(" ");

// "(Light Novel)" or a volume number sometimes sits in the subtitle
const titleOf = (info: NonNullable<Item["volumeInfo"]>) =>
  [info.title, /light novel|\bvol/i.test(info.subtitle ?? "") && info.subtitle]
    .filter(Boolean)
    .join(" ");

// after Google says the day's lookups are used up (429), it's left alone for
// a while rather than asked again by every page
const BACK_OFF_MS = 6 * 60 * 60 * 1000;
let backOffUntil = 0;
// whether Google is being left alone just now, its day's lookups used up:
// a lookup then finds nothing, which isn't the same as there being nothing.
// (With no key at all it's simply not one of our catalogs: never "paused")
export const googleLookupsPaused = () =>
  Boolean(config.GOOGLE_BOOKS_API_KEY) && Date.now() < backOffUntil;

export async function googleSeriesVolumes(
  name: string,
  timeoutMs = 10000,
): Promise<CatalogBook[]> {
  const key = config.GOOGLE_BOOKS_API_KEY;
  if (!key) return [];
  const books: CatalogBook[] = [];
  // what Google says of each book it found, kept for their pages: no
  // lookup of its own (models/volumeDetails.ts)
  const details: VolumeDetails[] = [];
  for (let page = 0; page < PAGES; page++) {
    const params = new URLSearchParams({
      // each word on its own, punctuation dropped: Google spells "Journey’s"
      // with a curly apostrophe, and an exact phrase can then match nothing
      q: titleWords(baseName(name)),
      printType: "books",
      langRestrict: "en",
      maxResults: String(PAGE),
      startIndex: String(page * PAGE),
      key,
    });
    if (Date.now() < backOffUntil)
      throw new Error("Google Books lookups used up for now");
    void noteCall("gbooks");
    const res = await fetch(`${URL}?${params}`, {
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (res.status === 429) backOffUntil = Date.now() + BACK_OFF_MS;
    if (!res.ok) throw new Error(`Google Books responded ${res.status}`);
    const { items = [], totalItems = 0 } = (await res.json()) as {
      items?: Item[];
      totalItems?: number;
    };
    for (const { volumeInfo: info } of items) {
      const isbn13 = info?.industryIdentifiers?.find(
        (i) => i.type === "ISBN_13",
      )?.identifier;
      if (!info?.title || !isbn13 || (info.language && info.language !== "en"))
        continue;
      const book = await bookFromListing({
        isbn13,
        title: titleOf(info),
        authors: info.authors,
        publisher: info.publisher ?? null,
        year: Number(info.publishedDate?.slice(0, 4)) || null,
        pages: info.pageCount ?? null,
        published: info.publishedDate ?? null,
      });
      if (!book) continue;
      books.push(book);
      details.push(detailsOf(isbn13, info));
    }
    if ((page + 1) * PAGE >= totalItems) break;
  }
  saveVolumeDetails(details).catch((e: Error) =>
    console.error("saving volume details:", e.message),
  );
  return books;
}

// what a Google record says of its own book, for its page
const detailsOf = (
  isbn13: string,
  info: NonNullable<Item["volumeInfo"]>,
): VolumeDetails => ({
  isbn13,
  description: info.description ?? null,
  pages: info.pageCount ?? null,
  published: info.publishedDate ?? null,
});

// One book's description, page count and release date, asked of Google by
// its ISBN, for the slow fill (prices/volumeDetails.ts). An empty answer
// when Google has no such book; null when it couldn't be asked (no key, the
// day's lookups used up, or a failure), so it's tried again another day
export async function googleDetailsOf(
  isbn13: string,
  timeoutMs = 6000,
): Promise<VolumeDetails | null> {
  const key = config.GOOGLE_BOOKS_API_KEY;
  if (!key || Date.now() < backOffUntil) return null;
  const params = new URLSearchParams({
    q: `isbn:${isbn13}`,
    maxResults: "1",
    fields:
      "items(volumeInfo(description,pageCount,publishedDate,industryIdentifiers))",
    key,
  });
  void noteCall("gbooks");
  const res = await fetch(`${URL}?${params}`, {
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (res.status === 429) backOffUntil = Date.now() + BACK_OFF_MS;
  if (!res.ok) return null;
  const { items = [] } = (await res.json()) as { items?: Item[] };
  // only the book itself: Google's search can answer with a near match
  const info = items.find((item) =>
    item.volumeInfo?.industryIdentifiers?.some(
      (i) => i.type === "ISBN_13" && i.identifier === isbn13,
    ),
  )?.volumeInfo;
  return info
    ? detailsOf(isbn13, info)
    : { isbn13, description: null, pages: null, published: null };
}

// The words an edition's book has in its title, one search each: "Naruto
// (3-in-1 Edition)", "Tokyo Revengers (Omnibus)", "Berserk Deluxe Volume 1"
const EDITION_WORDS = ["edition", "omnibus", "deluxe"];
// a book as an edition line reads it (editionLines.ts EditionDoc)
export type GoogleEditionBook = {
  title: string;
  isbn13: string;
  publishers: string[];
  pages: number | null;
  // the day it came out, as its publisher told Google: "2013-02-05"
  published: string | null;
};

// The books of a series' omnibus and deluxe editions, from publishers' own
// records: "Naruto (3-in-1 Edition), Vol. 4: Includes vols. 10, 11 & 12",
// with the day each came out. Open Library is missing most of these (of 57
// popular editions it had 21 right: scripts/checkEditions.ts). Up to six of
// the day's lookups a series; none with no key, and whatever was found
// before a search failed. `whole` is false when a search failed or the day
// was used up: what's missing then isn't known to be missing
export async function googleEditionBooks(
  name: string,
  // who wrote it, as AniList names them ("Naoki Urasawa"): the search is
  // then theirs only. Without it "Monster" finds a hundred other monsters
  authors: string[] = [],
  timeoutMs = 8000,
): Promise<{ books: GoogleEditionBook[]; whole: boolean }> {
  const key = config.GOOGLE_BOOKS_API_KEY;
  if (!key) return { books: [], whole: true };
  // by family name, the last word: Google files "Urasawa, Naoki" too
  const familyName = authors[0]?.trim().split(/\s+/).at(-1);
  const byThem = familyName ? ` inauthor:${familyName}` : "";
  const theirs = await searchEditionWords(name, byThem, key, timeoutMs);
  // AniList and Google don't always spell an author alike ("Tsugumi Ooba"
  // is Google's "Ohba", "Atsushi Ookubo" its "Ohkubo"): a search by them
  // that finds nothing at all is asked again without the name
  if (theirs.books.length || !byThem) return theirs;
  return searchEditionWords(name, "", key, timeoutMs);
}

// the three searches, each up to two pages; `byThem` narrows them to an
// author (" inauthor:Urasawa") or is empty
async function searchEditionWords(
  name: string,
  byThem: string,
  key: string,
  timeoutMs: number,
): Promise<{ books: GoogleEditionBook[]; whole: boolean }> {
  const found = new Map<string, GoogleEditionBook>();
  let whole = true;
  // one word's search, a page after the other. The three words are asked
  // side by side: one after another, a slow day made a page wait 20 seconds
  const searchWord = async (word: string) => {
    for (let page = 0; page < PAGES; page++) {
      if (Date.now() < backOffUntil) {
        whole = false;
        return;
      }
      const params = new URLSearchParams({
        q: `${titleWords(baseName(name))} intitle:${word}${byThem}`,
        printType: "books",
        langRestrict: "en",
        maxResults: String(PAGE),
        startIndex: String(page * PAGE),
        key,
      });
      void noteCall("gbooks");
      let items: Item[];
      try {
        const res = await fetch(`${URL}?${params}`, {
          signal: AbortSignal.timeout(timeoutMs),
        });
        if (res.status === 429) backOffUntil = Date.now() + BACK_OFF_MS;
        if (!res.ok) {
          whole = false;
          break;
        }
        items = ((await res.json()) as { items?: Item[] }).items ?? [];
      } catch {
        whole = false;
        break;
      }
      for (const { volumeInfo: info } of items) {
        const isbn13 = info?.industryIdentifiers?.find(
          (i) => i.type === "ISBN_13",
        )?.identifier;
        // (langRestrict lets other languages through: the record says)
        if (!info?.title || !isbn13 || info.language !== "en") continue;
        if (found.has(isbn13)) continue;
        found.set(isbn13, {
          // what it holds is often in the subtitle: "Includes vols. 1, 2 & 3"
          title: [info.title, info.subtitle].filter(Boolean).join(": "),
          isbn13,
          publishers: info.publisher ? [info.publisher] : [],
          pages: info.pageCount ?? null,
          published: info.publishedDate ?? null,
        });
      }
      if (items.length < PAGE) break;
    }
  };
  await Promise.all(EDITION_WORDS.map(searchWord));
  return { books: [...found.values()], whole };
}

// Edition books of any series: one search by an edition's name, and its
// publisher when given ('intitle:"VIZBIG" inpublisher:"VIZ Media"'), a page
// of up to 40. For finding series whose editions we don't know yet
// (prices/editionDiscovery.ts); null when it failed, the day was used up or
// there's no key
export async function googleEditionSearch(
  words: string,
  publisher: string | null,
  page = 0,
  timeoutMs = 8000,
): Promise<GoogleEditionBook[] | null> {
  const key = config.GOOGLE_BOOKS_API_KEY;
  if (!key || Date.now() < backOffUntil) return null;
  const params = new URLSearchParams({
    q: `intitle:"${words}"${publisher ? ` inpublisher:"${publisher}"` : ""}`,
    printType: "books",
    langRestrict: "en",
    maxResults: String(PAGE),
    startIndex: String(page * PAGE),
    key,
  });
  void noteCall("gbooks");
  try {
    const res = await fetch(`${URL}?${params}`, {
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (res.status === 429) backOffUntil = Date.now() + BACK_OFF_MS;
    if (!res.ok) return null;
    const items = ((await res.json()) as { items?: Item[] }).items ?? [];
    return items.flatMap(({ volumeInfo: info }) => {
      const isbn13 = info?.industryIdentifiers?.find(
        (i) => i.type === "ISBN_13",
      )?.identifier;
      if (!info?.title || !isbn13 || info.language !== "en") return [];
      return [
        {
          title: [info.title, info.subtitle].filter(Boolean).join(": "),
          isbn13,
          publishers: info.publisher ? [info.publisher] : [],
          pages: info.pageCount ?? null,
          published: info.publishedDate ?? null,
        },
      ];
    });
  } catch {
    return null;
  }
}

// A book's title by its ISBN, as its publisher gave it to Google: "Rurouni
// Kenshin (3-in-1 Edition), Vol. 1", where Open Library has only "Rurouni
// Kenshin, Vol. 1". The second catalog for a book's edition, asked only when
// Open Library's own record doesn't say (catalog.ts lookupIsbn). One of the
// day's lookups; null with no key, no such book, or the day used up
export async function googleRecordOf(isbn13: string, timeoutMs = 6000) {
  const key = config.GOOGLE_BOOKS_API_KEY;
  if (!key || Date.now() < backOffUntil) return null;
  const params = new URLSearchParams({
    q: `isbn:${isbn13}`,
    maxResults: "1",
    key,
  });
  void noteCall("gbooks");
  const res = await fetch(`${URL}?${params}`, {
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (res.status === 429) backOffUntil = Date.now() + BACK_OFF_MS;
  if (!res.ok) return null;
  const { items = [] } = (await res.json()) as { items?: Item[] };
  const info = items[0]?.volumeInfo;
  // kept for the book's page, when it's this very book
  if (
    info?.industryIdentifiers?.some(
      (i) => i.type === "ISBN_13" && i.identifier === isbn13,
    )
  )
    saveVolumeDetails([detailsOf(isbn13, info)]).catch(() => {});
  return info?.title
    ? {
        title: info.title,
        subtitle: info.subtitle,
        pages: info.pageCount ?? null,
      }
    : null;
}

// One volume asked for by number, for a series whose list has a gap there or
// only a library rebind ("One Piece 8"): the series search's 80 results don't
// reach every volume of a long runner. Only an English book whose title says
// this number comes back; the caller decides whether it beats what it has
export async function googleVolume(
  name: string,
  volume: number,
  timeoutMs = 8000,
  // editions to pass over (a rebind, another publisher's copy): the next
  // answer is tried in place of one
  passOver: (isbn13: string) => boolean = () => false,
): Promise<CatalogBook | null> {
  const key = config.GOOGLE_BOOKS_API_KEY;
  if (!key) return null;
  if (Date.now() < backOffUntil)
    throw new Error("Google Books lookups used up for now");
  const params = new URLSearchParams({
    q: `${titleWords(baseName(name))} ${volume}`,
    printType: "books",
    langRestrict: "en",
    maxResults: "10",
    key,
  });
  void noteCall("gbooks");
  const res = await fetch(`${URL}?${params}`, {
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (res.status === 429) backOffUntil = Date.now() + BACK_OFF_MS;
  if (!res.ok) throw new Error(`Google Books responded ${res.status}`);
  const { items = [] } = (await res.json()) as { items?: Item[] };
  for (const { volumeInfo: info, saleInfo } of items) {
    const isbn13 = info?.industryIdentifiers?.find(
      (i) => i.type === "ISBN_13",
    )?.identifier;
    if (!info?.title || !isbn13 || (info.language && info.language !== "en"))
      continue;
    // never the digital edition: its ISBN isn't the printed book's, so no
    // store's shelf price is found under it
    if (saleInfo?.isEbook) continue;
    const book = await bookFromListing({
      isbn13,
      title: titleOf(info),
      authors: info.authors,
      publisher: info.publisher ?? null,
      year: Number(info.publishedDate?.slice(0, 4)) || null,
      pages: info.pageCount ?? null,
      published: info.publishedDate ?? null,
    });
    if (book?.volume === volume && !passOver(book.isbn13)) return book;
  }
  return null;
}
