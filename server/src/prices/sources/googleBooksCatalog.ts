// Google Books, as a second catalog. It lists books from publishers' own
// data, months before they ship, where Open Library mostly adds a book once
// libraries have it (I See You, Aizawa-san! Vol. 1, out 2027, isn't there).
// So it fills the gaps Open Library leaves: new and upcoming volumes, and
// series Open Library doesn't know yet. Needs GOOGLE_BOOKS_API_KEY (1,000
// free lookups a day; series lists are saved, so it's asked rarely). Without
// one it finds nothing
import config from "../../config/config.js";
import { baseName } from "../lightNovel.js";
import { bookFromListing } from "./catalog.js";
import type { CatalogBook } from "../types.js";

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
    industryIdentifiers?: { type: string; identifier: string }[];
  };
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

export async function googleSeriesVolumes(
  name: string,
  timeoutMs = 10000,
): Promise<CatalogBook[]> {
  const key = config.GOOGLE_BOOKS_API_KEY;
  if (!key) return [];
  const books: CatalogBook[] = [];
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
      if (book) books.push(book);
    }
    if ((page + 1) * PAGE >= totalItems) break;
  }
  return books;
}

// One volume asked for by number, for a series whose list has a gap there or
// only a library rebind ("One Piece 8"): the series search's 80 results don't
// reach every volume of a long runner. Only an English book whose title says
// this number comes back; the caller decides whether it beats what it has
export async function googleVolume(
  name: string,
  volume: number,
  timeoutMs = 8000,
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
  const res = await fetch(`${URL}?${params}`, {
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (res.status === 429) backOffUntil = Date.now() + BACK_OFF_MS;
  if (!res.ok) throw new Error(`Google Books responded ${res.status}`);
  const { items = [] } = (await res.json()) as { items?: Item[] };
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
    if (book?.volume === volume) return book;
  }
  return null;
}
