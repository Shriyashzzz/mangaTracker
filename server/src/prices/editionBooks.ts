// A book of an edition, found in its series: "Vagabond VIZBIG Edition, Vol.
// 1" is book 1 of Vagabond's VIZBIG line and holds vols 1 to 3. A barcode
// scan asks (which volumes go on the shelf) and so does the book's own price
// page (is it a real book of a series we know, and which book is next).
//
// The series' edition lines say (editionSource.ts): built from the catalog,
// kept a week. `lookUp` false reads only what's saved (a crawler's visit).
import priceQueries from "../models/priceQueries.js";
import type { Country } from "../models/priceTables.js";
import {
  bookName,
  type EditionBook,
  type EditionLine,
} from "./editionLines.js";
import { editionLinesOf } from "./editionSource.js";
import type { CatalogBook } from "./types.js";

type Series = { name: string; volumes: { isbn13: string }[] };

export type BookInLine = { line: EditionLine; book: EditionBook };

// this ISBN's book in the series' edition lines, or null when no line has it
export async function bookInLine(
  series: Series,
  isbn13: string,
  lookUp = true,
): Promise<BookInLine | null> {
  const lines = await editionLinesOf(
    series.name,
    series.volumes as unknown as CatalogBook[],
    lookUp,
  ).catch(() => [] as EditionLine[]);
  for (const line of lines) {
    const book = line.books.find((b) => b.isbn13?.trim() === isbn13);
    if (book) return { line, book };
  }
  return null;
}

// the rest of its line, as the price page lists a volume's neighbours: each
// with an ISBN, numbered as the edition numbers them, with its saved price
export async function restOfLine(
  seriesName: string,
  { line, book }: BookInLine,
  country: Country,
) {
  const others = line.books.filter(
    (b): b is EditionBook & { isbn13: string } =>
      Boolean(b.isbn13) && b.isbn13 !== book.isbn13,
  );
  const known = await priceQueries
    .getKnownPrices(
      others.map((b) => b.isbn13),
      country,
    )
    .catch(() => new Map<string, { priceCents: number; checkedAt: Date }>());
  return others.map((b) => ({
    isbn13: b.isbn13,
    title: b.title ?? `${seriesName} ${bookName(line.label, b.number)}`,
    volume: b.number,
    coverUrl: `/api/prices/cover/${b.isbn13}`,
    knownPriceCents: known.get(b.isbn13)?.priceCents ?? null,
    knownCheckedAt: known.get(b.isbn13)?.checkedAt ?? null,
    recordedCents: null,
    usedCents: null,
    rating: null,
  }));
}
