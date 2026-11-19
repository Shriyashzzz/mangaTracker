// Editions whose books hold a set number of the series' volumes, with nothing
// in the title saying which: "Berserk Deluxe Edition, Vol. 2" is vols 4 to 6.
// A scanned barcode of one goes on the series' own shelf entry with every
// volume it holds, and its price page says what it holds.
//
// Two kinds, as the page's copy has them (client/src/lib/imports/
// bookVolumes.ts EDITIONS; tests/shelf/rulesInStep.test.ts fails if the two
// differ):
//   perBook        every book holds that many, and the last one whatever is
//                  left: fewer (Berserk Deluxe 14) or more (Rurouni Kenshin
//                  VIZBIG 9 holds four)
//   books/volumes  an edition regrouped by chapter (Fullmetal Edition puts 27
//                  volumes in 18 books): spread evenly, so every volume is in
//                  exactly one book. Owning every book is owning every volume
// Add an edition only from the publisher's own book and volume counts.
import { normalize } from "../../prices/stores/match.js";
import { withoutEdition } from "./editionNames.js";

type KnownEdition = {
  // the series' name, as normalize() leaves it
  series: string;
  edition: RegExp;
  perBook?: number;
  books: number;
  volumes: number;
  // Every one of its books is in print, checked against the publisher's own
  // listing: the app then knows they all exist, whether or not a catalog
  // lists them (Naruto 3-in-1 24, which Open Library lacks). Never set for
  // an edition still coming out: Vagabond's Definitive is planned as 13
  // books and has 6
  complete?: boolean;
};

const EDITIONS: KnownEdition[] = [
  // Deluxe 14 ends at vol. 41
  {
    series: "berserk",
    edition: /\bdeluxe\b/i,
    perBook: 3,
    books: 14,
    volumes: 41,
    complete: true,
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
    complete: true,
  },
  {
    series: "fruits basket",
    edition: /\bcollector'?s edition\b/i,
    perBook: 2,
    books: 12,
    volumes: 23,
    complete: true,
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
  // VIZ: 11 books of 2; its 12th is 21st Century Boys, a series of its own
  {
    series: "20th century boys",
    edition: /\bperfect edition\b/i,
    perBook: 2,
    books: 11,
    volumes: 22,
    complete: true,
  },
  // VIZ, 2018 to 2022: 18 books for the 27 volumes, regrouped by chapter
  {
    series: "fullmetal alchemist",
    edition: /\bfullmetal edition\b/i,
    books: 18,
    volumes: 27,
    complete: true,
  },
  // Vertical: 6 books for the 10 volumes
  {
    series: "blame",
    edition: /\bmaster edition\b/i,
    books: 6,
    volumes: 10,
    complete: true,
  },
  // Vertical: 8 books for the 15 volumes
  {
    series: "knights of sidonia",
    edition: /\bmaster edition\b/i,
    books: 7,
    volumes: 15,
    complete: true,
  },
  // Dark Horse: 3 books for the 10 volumes
  {
    series: "hellsing",
    edition: /\bdeluxe\b/i,
    books: 3,
    volumes: 10,
    complete: true,
  },
  // Kodansha: 6 books for the 9 volumes
  {
    series: "battle angel alita",
    edition: /\bdeluxe\b/i,
    books: 5,
    volumes: 9,
    complete: true,
  },
  // Dark Horse, 2018 to 2023: 12 omnibuses for the 37 volumes, three a book
  // and the last holding four
  {
    series: "gantz",
    edition: /\bomnibus\b/i,
    books: 12,
    volumes: 37,
    complete: true,
  },
  // Dark Horse: 5 hardcovers for the 14 volumes, three a book and the last
  // holding two (its own listing: 1-3, 4-6, 7-9, 10-12, 13-14)
  {
    series: "trigun maximum",
    edition: /\bdeluxe\b/i,
    perBook: 3,
    books: 5,
    volumes: 14,
    complete: true,
  },
  // Kodansha: 9 hardcovers for the 12 volumes
  {
    series: "cardcaptor sakura",
    edition: /\bcollector'?s edition\b/i,
    books: 9,
    volumes: 12,
    complete: true,
  },
  // Kodansha: 4 hardcovers for the 8 volumes
  {
    series: "chobits",
    edition: /\banniversary edition\b/i,
    books: 4,
    volumes: 8,
    complete: true,
  },
  // VIZ's Death Note Black Edition: 6 books of two for the 12 volumes
  {
    series: "death note",
    edition: /\bblack edition\b/i,
    perBook: 2,
    books: 6,
    volumes: 12,
    complete: true,
  },
  // Kodansha's Eternal Edition: 10 books for the 12 volumes
  {
    series: "sailor moon",
    edition: /\beternal edition\b/i,
    books: 10,
    volumes: 12,
    complete: true,
  },
  {
    series: "pretty guardian sailor moon",
    edition: /\beternal edition\b/i,
    books: 10,
    volumes: 12,
    complete: true,
  },
  // Tokyopop's Ultimate Editions: the name isn't a count. Fruits Basket's
  // six hold two each (vols 1 to 12, then the line stopped); Battle
  // Royale's five hold three each
  {
    series: "fruits basket",
    edition: /\bultimate edition\b/i,
    perBook: 2,
    books: 6,
    volumes: 12,
    complete: true,
  },
  {
    series: "battle royale",
    edition: /\bultimate edition\b/i,
    perBook: 3,
    books: 5,
    volumes: 15,
    complete: true,
  },
  // VIZ's 3-in-1 Rurouni Kenshin: nine books for the 28 volumes, the ninth
  // sold as a "4-in-1" holding vols 25 to 28
  {
    series: "rurouni kenshin",
    edition: /\b[34]\s*-?\s*in\s*-?\s*1\b/i,
    perBook: 3,
    books: 9,
    volumes: 28,
    complete: true,
  },
  // VIZ's VIZBIG: nine books for the 28 volumes, three each and the last
  // holding the four that are left
  {
    series: "rurouni kenshin",
    edition: /\bvizbig\b/i,
    perBook: 3,
    books: 9,
    volumes: 28,
    complete: true,
  },
  // VIZ's VIZBIG Dragon Ball: five books for the 16 volumes (the last holds
  // four), and nine for Dragon Ball Z's 26 (the last holds two)
  {
    series: "dragon ball",
    edition: /\bvizbig\b/i,
    perBook: 3,
    books: 5,
    volumes: 16,
    complete: true,
  },
  {
    series: "dragon ball z",
    edition: /\bvizbig\b/i,
    perBook: 3,
    books: 9,
    volumes: 26,
    complete: true,
  },
  // ---------- added 2026-11-19, from the check of popular series
  // (scripts/checkEditions.ts): each one finished, its book count the
  // publisher's, seen in Google Books' or Books-A-Million's own listing ----------
  // the last 3-in-1 books the catalogs don't list are still in print
  {
    series: "naruto",
    edition: /\b3\s*-?\s*in\s*-?\s*1\b/i,
    perBook: 3,
    books: 24,
    volumes: 72,
    complete: true,
  },
  // book 25 holds the last two ("Vol. 25: Includes vols. 73 & 74")
  {
    series: "bleach",
    edition: /\b3\s*-?\s*in\s*-?\s*1\b/i,
    perBook: 3,
    books: 25,
    volumes: 74,
    complete: true,
  },
  {
    series: "dragon ball",
    edition: /\b3\s*-?\s*in\s*-?\s*1\b/i,
    perBook: 3,
    books: 14,
    volumes: 42,
    complete: true,
  },
  {
    series: "fullmetal alchemist",
    edition: /\b3\s*-?\s*in\s*-?\s*1\b/i,
    perBook: 3,
    books: 9,
    volumes: 27,
    complete: true,
  },
  {
    series: "ouran high school host club",
    edition: /\b3\s*-?\s*in\s*-?\s*1\b/i,
    perBook: 3,
    books: 6,
    volumes: 18,
    complete: true,
  },
  // five volumes a book; the seventh holds the last four
  {
    series: "attack on titan",
    edition: /\bcolossal edition\b/i,
    perBook: 5,
    books: 7,
    volumes: 34,
    complete: true,
  },
  // the tenth omnibus holds four: 28 to 31
  {
    series: "blade of the immortal",
    edition: /\bomnibus\b/i,
    perBook: 3,
    books: 10,
    volumes: 31,
    complete: true,
  },
  // two a book; the fifteenth holds the last three ("Vol. 29-31")
  {
    series: "tokyo revengers",
    edition: /\bomnibus\b/i,
    perBook: 2,
    books: 15,
    volumes: 31,
    complete: true,
  },
  {
    series: "fairy tail",
    edition: /\bmaster'?s edition\b/i,
    perBook: 5,
    books: 5,
    volumes: 25,
    complete: true,
  },
  // regrouped by chapter, like the Fullmetal Edition: spread evenly
  {
    series: "soul eater",
    edition: /\bperfect edition\b/i,
    books: 17,
    volumes: 25,
    complete: true,
  },
  {
    series: "maison ikkoku",
    edition: /\bcollector'?s edition\b/i,
    books: 10,
    volumes: 15,
    complete: true,
  },
  // Dark Horse's two omnibuses, four volumes each
  {
    series: "chobits",
    edition: /\bomnibus\b/i,
    perBook: 4,
    books: 2,
    volumes: 8,
    complete: true,
  },
];

// the edition's words off a series' name: the one list (editionNames.ts)
export { withoutEdition };

// the editions the table knows for a series
export const knownEditionsOf = (series: string) => {
  const key = normalize(withoutEdition(series));
  return EDITIONS.filter((e) => e.series === key);
};

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
  const [from, to] = known.perBook
    ? [
        (book - 1) * known.perBook + 1,
        // the last book holds what's left
        book === known.books
          ? known.volumes
          : Math.min(book * known.perBook, known.volumes),
      ]
    : evenRange(book, known.books, known.volumes);
  return Array.from({ length: to - from + 1 }, (_, i) => from + i);
}

// the number of the book of a known edition that holds exactly these
// volumes; null when the table doesn't know the edition, or no book does
export function knownBookHolding(
  series: string,
  title: string,
  volumes: number[],
): number | null {
  const key = normalize(withoutEdition(series));
  const known = EDITIONS.find((e) => e.series === key && e.edition.test(title));
  if (!known) return null;
  for (let book = 1; book <= known.books; book++) {
    const holds = editionVolumes(series, title, book);
    if (holds?.join() === volumes.join()) return book;
  }
  return null;
}

// book `n` of `books` holding `volumes` between them, split evenly: 27 in 18
// is 1, 2 to 3, 4, 5 to 6, ... so every volume is in exactly one book
function evenRange(
  n: number,
  books: number,
  volumes: number,
): [number, number] {
  const from = Math.floor(((n - 1) * volumes) / books) + 1;
  const to = Math.floor((n * volumes) / books);
  return [from, Math.max(from, to)];
}
