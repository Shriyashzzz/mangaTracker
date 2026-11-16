// What a book import works with: a book (one row of the export, whatever app
// it came from) and a series (the shelf entry its books become). Part of the
// book import (bookImport.ts lists the parts).
import { type NewBook } from "../books";

export type BookSource = "goodreads" | "bookcatalogue" | "csv";

// one row of the export, whatever app it came from
export type Book = {
  title: string;
  series: string;
  // every name the series goes by, the series first: a Japanese edition's
  // "メイドインアビス 5 [Made in Abyss 5]" goes by both
  names: string[];
  volume: number | null;
  // only a number at the end of the title said so (readBooks checks it)
  guessed?: boolean;
  // every volume the book holds, when it's more than one: "Bleach (3-in-1
  // Edition), Vol. 21" is 61, 62 and 63 (volumesInside)
  holds?: number[];
  // an omnibus that doesn't say which volumes it holds ("Vinland Saga
  // Omnibus, Vol. 3"): its number is the omnibus', not a volume's
  omnibus?: boolean;
  owned: boolean;
  // the file says plainly they don't own it ("Owned: no"): a book read
  // isn't then counted as owned. Goodreads never says so: its Owned Copies
  // is left at 0 by most readers, even for books they have
  notOwned?: boolean;
  read: boolean;
  // reading it now: everything before it counts as read
  reading: boolean;
  // 1-5, 0 for not rated
  rating: number;
  // on a want-to-read list and nothing else
  planned: boolean;
  // the title says so: "Overlord, Vol. 1 (light novel)"
  lightNovel: boolean;
  // only Manga Tracker's own export says these (ownExportBooks). `exact`:
  // its names are the shelf's own, never joined to another by a guess
  exact?: boolean;
  finished?: boolean;
  chapter?: number;
  // the volume read up to, and whether the series keeps its place by it
  readTo?: number;
  byVolume?: boolean;
  notes?: string;
  genre?: string;
  // the edition they collect it in ("deluxe"), from a backup
  collecting?: string;
  // the row's ISBN, when the file has one: kept with the book (lib/books.ts)
  isbn?: string;
  // what they paid for it, from a "Price Paid" column: kept with the book
  paidCents?: number;
  // the day they bought it, from a "Date Purchased" column ("2025-11-02")
  boughtOn?: string;
  // the file has no read or status column: nothing is known about reading
  noReadStatus?: boolean;
  // how the book is bound, when a column says ("Hardcover"): an edition the
  // title doesn't name (JoJo Part 3's hardcovers are titled "Vol. 1")
  binding?: string;
  // a backup's own record of the series' books, on its first row
  ownBooks?: NewBook[];
  // when the file says it was last changed (read, or added): ISO text
  // (importDate.ts)
  changedOn?: string;
};

export type BookSeries = {
  key: string;
  title: string;
  // its other names, for AniList when the title finds nothing
  otherNames: string[];
  books: number;
  ownedVolumes: number;
  // exactly which volumes they own (One Piece 1 and 4): every owned book's
  // number. [] owns none; null when an owned book has no number, so the
  // file can't say exactly. Missing on imports saved before it was kept
  ownedList?: number[] | null;
  readVolumes: number;
  score: number;
  // nothing owned or read yet: only on a to-read list
  planned: boolean;
  lightNovel: boolean;
  // some of its books are omnibuses that don't say which volumes they hold,
  // so the count is worth a look before adding
  omnibus?: boolean;
  // a row that is several series AniList says are one (mergeSameSeries):
  // every one's key, its own first
  members?: string[];
  // the books whose volumes the file doesn't say (a box set, a deluxe
  // edition): named in the preview, so nothing is dropped without a word
  unsure?: string[];
  // volumes the file has a second copy of ("Chainsaw Man, Vol. 3" twice):
  // counted once, and said in the preview so a spare isn't lost without a word
  spares?: number[];
  // none of its books' files says anything about reading (Book.noReadStatus)
  readingUnknown?: boolean;
  // from Manga Tracker's own export: finished, the chapter they're on, notes
  restore?: boolean;
  finished?: boolean;
  chapters?: number;
  readTo?: number;
  byVolume?: boolean;
  notes?: string;
  genre?: string;
  // each owned book that says its volumes, with its ISBN and edition
  bookList?: NewBook[];
  collecting?: string;
  // the latest date any of its books was changed, for "Last updated"
  updatedAt?: string;
};
