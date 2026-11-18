// A book's title as its OWN record says it. Open Library keeps a work
// ("Monster") and, under it, each edition's record by ISBN. A search answers
// with the work's title, which for an edition's book is bare ("Monster",
// "20th Century Boys"), Japanese, or names no edition ("Dragon Ball Z, Vol.
// 1" for the VIZBIG). The ISBN's own record says the rest, across three
// fields:
//
//   title          "Monster"                 "One Piece, Vol. 1"
//   subtitle       "The Perfect Edition, Vol. 1"   "East Blue"
//   edition_name   (nothing)                 "Omnibus Edition"
//
// This puts them together the way the rest of the app reads a title:
// "Monster: The Perfect Edition, Vol. 1", "One Piece (Omnibus Edition), Vol.
// 1". Pure, so it's tested on real records (tests/prices/editionTitle.test.ts).
import { EDITION_NAMES } from "../../util/shelf/editionNames.js";

export type EditionRecord = {
  title?: string;
  subtitle?: string;
  edition_name?: string;
};

// the edition a piece of text names FIRST: a publisher's note can name two
// ("Eternal edition. New definitive edition.")
function firstEditionIn(text: string) {
  let first: { at: number; words: string } | null = null;
  for (const edition of EDITION_NAMES) {
    const found = edition.words.exec(text);
    if (found && (first === null || found.index < first.at))
      first = { at: found.index, words: found[0] };
  }
  return first?.words ?? null;
}

const namesAnEdition = (text: string) => firstEditionIn(text) !== null;
const NAMES_A_VOLUME = /\b(vol(ume)?\.?|book)\s*\d+/i;
const SAYS_WHAT_IT_HOLDS = /\bincludes\s+vols?\b/i;
// where a title's volume number starts: ", Vol. 1", " Volume 1"
const ITS_NUMBER = /,?\s*\bvol(?:ume)?\.?\s*\d+.*$/i;

const capitalised = (words: string) =>
  words.replace(/\b[a-z]/g, (letter) => letter.toUpperCase());

// a title with an edition put in brackets before its volume number, where
// catalogs put it: "One Piece (Omnibus Edition), Vol. 1"
function marked(title: string, editionWords: string) {
  const edition = /edition/i.test(editionWords)
    ? editionWords
    : `${editionWords} Edition`;
  const inBrackets = `(${capitalised(edition.toLowerCase())})`;
  const number = title.match(ITS_NUMBER);
  return number
    ? `${title.slice(0, number.index).trimEnd()} ${inBrackets}${number[0]}`
    : `${title.trimEnd()} ${inBrackets}`;
}

// A search's title that already names its volume, given the edition its own
// record names: it keeps everything it said (an omnibus lists each volume's
// name in brackets, which is how the app knows what it holds) and gains the
// edition. Unchanged when it names one already, or the record names none
export function withEditionOf(title: string, recordTitle: string) {
  const edition = firstEditionIn(recordTitle);
  return edition && !namesAnEdition(title) ? marked(title, edition) : title;
}

// the record's full title, or null when the record has no title
export function titleOfRecord(record: EditionRecord): string | null {
  const title = (record.title ?? "").trim();
  if (!title) return null;
  const subtitle = (record.subtitle ?? "").trim();
  // a subtitle is part of the name only when it says which edition or volume
  // this is, or what a set holds; an arc's name ("East Blue") isn't
  const telling =
    subtitle &&
    (namesAnEdition(subtitle) ||
      NAMES_A_VOLUME.test(subtitle) ||
      SAYS_WHAT_IT_HOLDS.test(subtitle));
  const full = telling ? `${title}: ${subtitle}` : title;
  if (namesAnEdition(full)) return full;
  // the edition only in the publisher's note: put in brackets before the
  // volume number, where catalogs put it ("One Piece (Omnibus Edition), Vol.
  // 1")
  const noted = firstEditionIn(record.edition_name ?? "");
  return noted ? marked(full, noted) : full;
}

// Whether the record's title should replace the one a search gave: when it
// names an edition the search's title doesn't, or a volume number the
// search's title lacks. A plain volume's title is left exactly as it was
export function saysMoreThan(recordTitle: string, searchTitle: string | null) {
  if (!searchTitle) return true;
  if (namesAnEdition(recordTitle) && !namesAnEdition(searchTitle)) return true;
  return NAMES_A_VOLUME.test(recordTitle) && !/\d/.test(searchTitle);
}
