// The rows of "Your books": one for each book a scan or an import recorded,
// and one for each owned volume that no recorded book holds (ticked by hand).
import { bookLabel, type NewBook, type OwnedBook } from "../../lib/books";

export type BookRow = {
  // steady across renders, for React and for the price typed into the row
  key: string;
  // the recorded book; null for a volume ticked by hand
  book: OwnedBook | null;
  // the hand-ticked volume; null when there's a recorded book
  volume: number | null;
};

// the first volume a row holds: what the list is sorted by
const firstVolume = (row: BookRow) =>
  row.book ? Math.min(...row.book.volumes) : row.volume!;

export function rowsOf(books: OwnedBook[], owned: number[]): BookRow[] {
  const inABook = new Set(books.flatMap((book) => book.volumes));
  const looseVolumes = owned.filter((volume) => !inABook.has(volume));

  const rows: BookRow[] = [];
  for (const book of books)
    rows.push({ key: `b${book.id}`, book, volume: null });
  for (const volume of looseVolumes)
    rows.push({ key: `v${volume}`, book: null, volume });
  return rows.sort((a, b) => firstVolume(a) - firstVolume(b));
}

// "Deluxe 2 (vols. 4–6)", or "Vol. 7" for a volume ticked by hand
export const rowName = (row: BookRow) =>
  row.book ? bookLabel(row.book) : `Vol. ${row.volume}`;

// the book a hand-ticked volume becomes once it's given a price or a date
export const looseBook = (volume: number): NewBook => ({
  isbn13: null,
  edition: "single",
  number: volume,
  title: null,
  volumes: [volume],
});

// 1299 -> "12.99", for a price box
export const moneyText = (cents: number | null | undefined) =>
  cents == null ? "" : (cents / 100).toFixed(2);
