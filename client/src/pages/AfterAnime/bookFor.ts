// Which book of a series' English list is volume N, for the "after the
// anime" pages, and what to call it.
import type { SeriesVolume } from "../../lib/types";

const pricedFirst = (books: SeriesVolume[]) =>
  books.find((v) => v.knownPriceCents !== null) ?? books[0] ?? null;

// the book for a volume number: one sold on its own, with a price when
// there's a choice. A series sold in English only as books of two or three
// (Vinland Saga's Book 7 holds vols. 13 and 14): the book that holds it
export function bookFor(volumes: SeriesVolume[], number: number) {
  const alone = volumes.filter((v) => v.volume === number && !v.inBook);
  const holding = volumes.filter(
    (v) => v.inBook && v.inBook.from <= number && number <= v.inBook.to,
  );
  return pricedFirst(alone) ?? pricedFirst(holding);
}

// the book after the one with volume N in it: the next volume, or for a
// book of two, the book after it
export function bookAfter(volumes: SeriesVolume[], number: number) {
  const book = bookFor(volumes, number);
  return bookFor(volumes, book?.inBook ? book.inBook.to + 1 : number + 1);
}

// what to call it in a sentence: "volume 14", or "Book 7 (vols. 13–14)"
export function bookWords(book: SeriesVolume | null, number: number) {
  if (!book?.inBook) return `volume ${number}`;
  const { book: n, from, to } = book.inBook;
  return `Book ${n} (vols. ${from}–${to})`;
}

// and on a button or a heading: "vol. 14", or "Book 7"
export function bookShort(book: SeriesVolume | null, number: number) {
  return book?.inBook ? `Book ${book.inBook.book}` : `vol. ${number}`;
}
