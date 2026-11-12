// Editions whose books each hold a fixed number of the series' volumes, with
// nothing in the title saying which: "Berserk Deluxe Edition, Vol. 2" is vols
// 4 to 6. A scanned barcode of one goes on the series' own shelf entry with
// every volume it holds. Kept in step with the import's table
// (client/src/lib/imports/bookImport.ts EDITIONS)
import { normalize } from "../../prices/stores/match.js";

const EDITIONS: {
  series: string;
  edition: RegExp;
  perBook: number;
  books: number;
  volumes: number;
}[] = [
  {
    series: "berserk",
    edition: /\bdeluxe\b/i,
    perBook: 3,
    books: 14,
    volumes: 42,
  },
  {
    series: "vinland saga",
    edition: /\bbook\b|\bhardcover\b/i,
    perBook: 2,
    books: 7,
    volumes: 14,
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
];

// the edition's words off the series' name: "Berserk Deluxe Edition" is Berserk
// (words that end real names, "Rave Master", only before "Edition")
const EDITION_WORDS =
  /[\s,:(-]+(the\s+)?(deluxe(\s+edition)?|(perfect|collector'?s|fullmetal|master|ultimate)\s+edition)\)?\s*$/i;
export const withoutEdition = (name: string) =>
  name.replace(EDITION_WORDS, "").trim() || name;

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
