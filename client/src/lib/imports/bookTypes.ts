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
