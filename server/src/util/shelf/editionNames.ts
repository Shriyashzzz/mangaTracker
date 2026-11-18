// Every edition a series is sold in, in ONE list: "Berserk Deluxe Edition",
// "Vagabond VIZBIG Edition", "Vagabond Definitive Edition" are all books of
// Berserk and Vagabond. Everything that reads an edition out of a title asks
// here, so a scan, a price page, the shelf check and the edition lines can
// never disagree about where a series' name ends and its edition begins:
//
//   editionNameOf   which edition a title names, if any
//   withoutEdition  the series' own name, the edition's words taken off
//
// A new edition is one line added to EDITION_NAMES. No imports.

export type EditionName = {
  // what a shelf entry saves as the edition it collects, and what a line of
  // books is filed under (prices/editionLines.ts). Up to 20 letters
  key: string;
  // how the app says it: "Deluxe 2", "VIZBIG 3"
  label: string;
  // a few letters for where the whole word won't fit: the stamp on a compact
  // row's small cover
  short: string;
  // omnibus: plain volumes bound together; deluxe: a bigger, dearer book
  kind: "omnibus" | "deluxe";
  // the words that name it in a title. One that is also the end of real
  // series names ("Rave Master") only counts before "Edition"
  words: RegExp;
  // how many volumes each book holds, when the name itself says
  perBook?: number;
};

// most specific first: "3-in-1 Deluxe Edition" is a deluxe
export const EDITION_NAMES: EditionName[] = [
  {
    key: "deluxe",
    kind: "deluxe",
    label: "Deluxe",
    short: "DLX",
    words: /\bdeluxe\b/i,
  },
  {
    key: "perfect",
    kind: "deluxe",
    label: "Perfect Edition",
    short: "PERF",
    words: /\bperfect\s+edition\b/i,
  },
  {
    key: "collectors",
    kind: "deluxe",
    label: "Collector's Edition",
    short: "COLL",
    words: /\bcollector'?s\s+edition\b/i,
  },
  {
    key: "master",
    kind: "deluxe",
    label: "Master Edition",
    short: "MSTR",
    words: /\bmaster\s+edition\b/i,
  },
  {
    key: "fullmetal",
    kind: "deluxe",
    label: "Fullmetal Edition",
    short: "FULL",
    words: /\bfullmetal\s+edition\b/i,
  },
  {
    key: "definitive",
    kind: "deluxe",
    label: "Definitive",
    short: "DEF",
    words: /\bdefinitive\s+edition\b/i,
  },
  {
    key: "eternal",
    kind: "deluxe",
    label: "Eternal Edition",
    short: "ETRN",
    words: /\beternal\s+edition\b/i,
  },
  {
    key: "complete",
    kind: "deluxe",
    label: "Complete Edition",
    short: "CMPL",
    words: /\bcomplete\s+(edition|collection)\b/i,
  },
  {
    key: "anniversary",
    kind: "deluxe",
    label: "Anniversary Edition",
    short: "ANNV",
    words: /\b(\d+(st|nd|rd|th)\s+)?anniversary\s+edition\b/i,
  },
  {
    key: "hardcover",
    kind: "deluxe",
    label: "Hardcover",
    short: "HC",
    words: /\bhardcover\s+edition\b/i,
  },
  {
    key: "kanzenban",
    kind: "deluxe",
    label: "Kanzenban",
    short: "KZB",
    words: /\bkanzenban\b/i,
  },
  {
    key: "black",
    kind: "omnibus",
    label: "Black Edition",
    short: "BLK",
    words: /\bblack\s+edition\b/i,
    perBook: 2,
  },
  {
    key: "ultimate",
    kind: "omnibus",
    label: "Ultimate Edition",
    short: "ULT",
    // two a book for Fruits Basket, three for Battle Royale: the name
    // isn't a count, so the hand table says (util/shelf/editions.ts)
    words: /\bultimate\s+edition\b/i,
  },
  // big books of several volumes; how many isn't in the name, so the
  // series' lines say, or the reader is asked
  {
    key: "colossal",
    kind: "omnibus",
    label: "Colossal Edition",
    short: "COL",
    words: /\bcolossal\s+edition\b/i,
  },
  {
    key: "masters",
    kind: "omnibus",
    label: "Master's Edition",
    short: "MSTR",
    words: /\bmaster'?s\s+edition\b/i,
  },
  {
    key: "legendary",
    kind: "omnibus",
    label: "Legendary Edition",
    short: "LGND",
    words: /\blegendary\s+edition\b/i,
  },
  // a whole series in one book ("Death Note (All-in-One Edition)")
  {
    key: "allinone",
    kind: "omnibus",
    label: "All-in-One",
    short: "ALL",
    words: /\ball\s*-?\s*in\s*-?\s*one\b/i,
  },
  {
    key: "vizbig",
    kind: "omnibus",
    label: "VIZBIG",
    short: "VIZ",
    words: /\bvizbig\b/i,
    perBook: 3,
  },
  // rare, and no count of its own: Rurouni Kenshin's is the last book of
  // its 3-in-1 line, holding four (the hand table says: editions.ts)
  {
    key: "4in1",
    kind: "omnibus",
    label: "4-in-1",
    short: "4-IN-1",
    words: /\b4\s*-?\s*in\s*-?\s*1\b/i,
  },
  {
    key: "3in1",
    kind: "omnibus",
    label: "3-in-1",
    short: "3-IN-1",
    words: /\b3\s*-?\s*in\s*-?\s*1\b/i,
    perBook: 3,
  },
  {
    key: "2in1",
    kind: "omnibus",
    label: "2-in-1",
    short: "2-IN-1",
    words: /\b2\s*-?\s*in\s*-?\s*1\b/i,
    perBook: 2,
  },
  {
    key: "omnibus",
    kind: "omnibus",
    label: "Omnibus",
    short: "OMNI",
    words: /\bomnibus\b/i,
  },
];

// the edition a title names: "Vagabond Definitive Edition, Vol. 3" is the
// Definitive; a plain volume's title names none
export const editionNameOf = (title: string): EditionName | null =>
  EDITION_NAMES.find((edition) => edition.words.test(title)) ?? null;

// an edition's words ending a name, with what joins them to it ("Berserk:
// The Deluxe Edition", "Naruto (3-in-1 Edition)")
const ANY_EDITION = EDITION_NAMES.map((edition) => edition.words.source).join(
  "|",
);
// ("Tomie: Complete Deluxe Edition" is Tomie: "complete" belongs to the
// edition; and "Ocarina of Time -Legendary Edition-" ends in a dash)
const ENDS_IN_EDITION = new RegExp(
  `[\\s,:(-]+(the\\s+)?(complete\\s+)?(${ANY_EDITION})(\\s+edition)?[)\\s-]*$`,
  "i",
);

// a box set's words ending a name: "Claymore Complete Box Set", "Naruto Box
// Set 2", "Akira 35th Anniversary Box Set". A box set is its series' too.
// What a set says after its name goes with it: "One Piece Box Set 1: East
// Blue and Baroque Works: Volumes 1-23 with Premium" is One Piece
const ENDS_IN_BOX_SET =
  /[\s,:(-]+((the\s+)?complete\s+(series\s+)?|\d+(st|nd|rd|th)\s+anniversary\s+)?box(ed)?\s*set(\s*\d+)?\)?(\s*:.*)?\s*$/i;

// the edition's words off the series' name: "Berserk Deluxe Edition" is
// Berserk, "Vagabond VIZBIG Edition" is Vagabond, "Claymore Complete Box Set"
// is Claymore. Taken off again while there are more ("Uzumaki 3-in-1 Deluxe
// Edition"). A name that is nothing but an edition's words is left as it is
export function withoutEdition(name: string) {
  let series = name.trim();
  for (let i = 0; i < 3; i++) {
    const shorter = series
      .replace(ENDS_IN_BOX_SET, "")
      .replace(ENDS_IN_EDITION, "")
      .trim();
    if (shorter === series) break;
    series = shorter;
  }
  return series || name;
}

// The volumes a book holds when its edition's own name says how many: book
// 2 of a 3-in-1 (or a VIZBIG, which is three) holds vols 4 to 6. Not a
// guess: the name is the count. null for an edition whose books vary
// ("Deluxe"), which the series' lines or the hand table have to say
// A 2-in-1 or 3-in-1 whose title has no number of its own ("Uzumaki (3-in-1
// Deluxe Edition)") is the first, or the only one: book 1. Any other
// edition without a number can't say which book it is
export const onlyBookOf = (edition: EditionName) =>
  /^[23]in1$/.test(edition.key) ? 1 : null;

export function volumesByName(edition: EditionName, number: number | null) {
  const each = edition.perBook;
  if (!each || !number || !Number.isInteger(number) || number < 1) return null;
  return Array.from({ length: each }, (_, i) => (number - 1) * each + 1 + i);
}
