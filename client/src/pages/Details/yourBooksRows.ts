// The rows of "Your books": one for each book a scan or an import recorded,
// and one for each owned volume that no recorded book holds (ticked by hand).
// Latest volume first: the newest book is the one they've come to price.
import { bookLabel, type NewBook, type OwnedBook } from "../../lib/books";

export type BookRow = {
  // steady across renders, for React and for the price typed into the row
  key: string;
  // the recorded book; null for a volume ticked by hand
  book: OwnedBook | null;
  // the hand-ticked volume; null when there's a recorded book
  volume: number | null;
  // a second copy of a book already listed ("Vol. 1 (spare)")
  spare?: boolean;
};

// the last volume a row holds: what the list is sorted by, so "Deluxe 2
// (vols. 4–6)" sits between vol. 7 and vol. 3
const lastVolume = (row: BookRow) =>
  row.book ? Math.max(...row.book.volumes) : row.volume!;

export function rowsOf(books: OwnedBook[], owned: number[]): BookRow[] {
  const inABook = new Set(books.flatMap((book) => book.volumes));
  const looseVolumes = owned.filter((volume) => !inABook.has(volume));

  const rows: BookRow[] = [];
  // the books seen so far, by edition and volumes: one seen again is a spare
  const seen = new Set<string>();
  for (const book of books) {
    const same = `${book.edition}:${book.volumes.join(",")}`;
    rows.push({
      key: `b${book.id}`,
      book,
      volume: null,
      spare: seen.has(same),
    });
    seen.add(same);
  }
  for (const volume of looseVolumes)
    rows.push({ key: `v${volume}`, book: null, volume });
  return rows.sort((a, b) => lastVolume(b) - lastVolume(a));
}

// "Deluxe 2 (vols. 4–6)", or "Vol. 7" for a volume ticked by hand, and
// "Vol. 1 (spare)" for a second copy
export const rowName = (row: BookRow) =>
  row.book
    ? `${bookLabel(row.book)}${row.spare ? " (spare)" : ""}`
    : `Vol. ${row.volume}`;

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
