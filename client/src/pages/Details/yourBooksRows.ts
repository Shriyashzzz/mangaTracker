// The rows of "Your books": one for each book a scan or an import recorded,
// and one for each owned volume that no recorded book holds (ticked by hand).
// Latest volume first: the newest book is the one they've come to price.
//
// Someone collecting the series as an edition (Vagabond as Definitive) sees
// their hand-ticked volumes through it, as the shelf above shows them: vols.
// 4 to 6 are one row, "Definitive 2 (vols. 4–6)", not three. Nothing is
// saved for that: the row is worked out from what they own each time, so
// the list and the shelf can't fall out of step. It becomes a recorded book
// the moment it's given a price or a day, like any hand-ticked volume.
import { bookLabel, type NewBook, type OwnedBook } from "../../lib/books";
import {
  asOwnedBook,
  editionBookLabel,
  insideText,
  type EditionBook,
  type EditionLine,
} from "../../lib/editions";
import type { EditionShelf } from "../../lib/editionShelf";

export type BookRow = {
  // steady across renders, for React and for the price typed into the row
  key: string;
  // the recorded book; null for a volume ticked by hand
  book: OwnedBook | null;
  // the hand-ticked volume; null when there's a recorded book, or the row
  // is a book of the edition they collect
  volume: number | null;
  // hand-ticked volumes that fill a book of the edition they collect
  ofEdition?: { line: EditionLine; book: EditionBook };
  // a second copy of a book already listed ("Vol. 1 (spare)")
  spare?: boolean;
};

// the last volume a row holds: what the list is sorted by, so "Deluxe 2
// (vols. 4–6)" sits between vol. 7 and vol. 3
const lastVolume = (row: BookRow) => Math.max(...volumesOf(row));

// the volumes a row holds
export const volumesOf = (row: BookRow) =>
  row.book?.volumes ?? row.ofEdition?.book.volumes ?? [row.volume!];

export function rowsOf(
  books: OwnedBook[],
  owned: number[],
  // the edition they collect, as the shelf shows it; null for single volumes
  collects: EditionShelf | null = null,
): BookRow[] {
  const inABook = new Set(books.flatMap((book) => book.volumes));
  const loose = new Set(owned.filter((volume) => !inABook.has(volume)));
  // the edition's books that hand-ticked volumes fill, every one of them
  const filled = (collects?.slots ?? []).flatMap((slot) =>
    slot.book && slot.volumes.every((v) => loose.has(v)) ? [slot.book] : [],
  );
  const inFilled = new Set(filled.flatMap((book) => book.volumes));
  const looseVolumes = [...loose].filter((volume) => !inFilled.has(volume));

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
  for (const book of filled)
    rows.push({
      key: `e${collects!.line.key}:${book.number}`,
      book: null,
      volume: null,
      ofEdition: { line: collects!.line, book },
    });
  for (const volume of looseVolumes)
    rows.push({ key: `v${volume}`, book: null, volume });
  return rows.sort((a, b) => lastVolume(b) - lastVolume(a));
}

// "Deluxe 2 (vols. 4–6)", or "Vol. 7" for a volume ticked by hand, and
// "Vol. 1 (spare)" for a second copy
export const rowName = (row: BookRow) => {
  if (row.book) return `${bookLabel(row.book)}${row.spare ? " (spare)" : ""}`;
  if (row.ofEdition) {
    const { line, book } = row.ofEdition;
    return `${editionBookLabel(line, book)} (${insideText(book)})`;
  }
  return `Vol. ${row.volume}`;
};

// the book a row with no record becomes once it's given a price or a day:
// the edition's book, with its ISBN, or the single volume
export const newBookOf = (row: BookRow): NewBook =>
  row.ofEdition
    ? asOwnedBook(row.ofEdition.line, row.ofEdition.book)
    : looseBook(row.volume!);

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
