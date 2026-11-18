// Editions whose books each hold a fixed number of the series' volumes, with
// nothing in the title saying which: "Berserk Deluxe Edition, Vol. 2" is vols
// 4 to 6. A scanned barcode of one goes on the series' own shelf entry with
// every volume it holds. Kept in step with the import's table
// (client/src/lib/imports/bookImport.ts EDITIONS)
import { normalize } from "../../prices/stores/match.js";
import { withoutEdition } from "./editionNames.js";

const EDITIONS: {
  series: string;
  edition: RegExp;
  perBook: number;
  books: number;
  volumes: number;
}[] = [
  // Deluxe 14 ends at vol. 41
  {
    series: "berserk",
    edition: /\bdeluxe\b/i,
    perBook: 3,
    books: 14,
    volumes: 41,
  },
  // the 3-in-1 deluxe hardcovers first, then Kodansha's 2-in-1 books: every
  // English "Book N" holds two (Book 9 is vols 17 and 18)
  {
    series: "vinland saga",
    edition: /\bdeluxe\b/i,
    perBook: 3,
    books: 10,
    volumes: 29,
  },
  {
    series: "vinland saga",
    edition: /\bbook\b|\bhardcover\b/i,
    perBook: 2,
    books: 15,
    volumes: 29,
  },
  {
    series: "monster",
    edition: /\bperfect edition\b/i,
    perBook: 2,
    books: 9,
    volumes: 18,
  },
  {
    series: "fruits basket",
    edition: /\bcollector'?s edition\b/i,
    perBook: 2,
    books: 12,
    volumes: 23,
  },
  // VIZ's Vagabond Definitive Edition (2025 on): three volumes a book, as
  // its publisher's listings say; 37 volumes, so 13 books
  {
    series: "vagabond",
    edition: /\bdefinitive\b/i,
    perBook: 3,
    books: 13,
    volumes: 37,
  },
  // VIZ's Death Note Black Edition: 6 books of two for the 12 volumes
  {
    series: "death note",
    edition: /\bblack edition\b/i,
    perBook: 2,
    books: 6,
    volumes: 12,
  },
];

// the edition's words off a series' name: the one list (editionNames.ts)
export { withoutEdition };

// the volumes one book of a known edition holds, or null
export function editionVolumes(
  series: string,
  title: string,
  book: number | null,
): number[] | null {
  const key = normalize(withoutEdition(series));
  const known = EDITIONS.find((e) => e.series === key && e.edition.test(title));
  if (!known || !book || !Number.isInteger(book) || book > known.books)
    return null;
  const from = (book - 1) * known.perBook + 1;
  const to = Math.min(book * known.perBook, known.volumes);
  return Array.from({ length: to - from + 1 }, (_, i) => from + i);
}
