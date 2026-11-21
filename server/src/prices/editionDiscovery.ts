// Finding series whose omnibus and deluxe editions we don't know yet. The
// edition lines (editionSource.ts) are only looked for in series we already
// know (series_info, collector/editionFiller.ts), so a series nobody had
// looked up could never show on /editions. This searches the other way
// round: by an edition's name and a manga publisher ('intitle:"VIZBIG"
// inpublisher:"VIZ Media"'), and reads each book's series off its title. A
// series that's new to us is then asked about once (AniList), which makes it
// known, and the edition job builds its lines like any other's.
//
// The edition names are the app's one list (util/shelf/editionNames.ts), so
// a search never finds an edition the rest of the app can't read. Pure here:
// the job that runs it is collector/editionFinder.ts
import { EDITION_NAMES } from "../util/shelf/editionNames.js";
import { isNovelName } from "./lightNovel.js";
import {
  editionOfTitle,
  isSetOfBooks,
  normalize,
  seriesOfBook,
} from "./stores/match.js";

// the English manga publishers whose edition lines are worth a search
export const EDITION_PUBLISHERS = [
  "VIZ Media",
  "Kodansha",
  "Dark Horse",
  "Seven Seas",
  "Yen Press",
  "Square Enix",
  "TOKYOPOP",
  "Udon",
];

export type EditionSearch = { words: string; publisher: string };

// every search, in a fixed order: each edition's name with each publisher
export const EDITION_SEARCHES: EditionSearch[] = EDITION_NAMES.flatMap(
  (edition) =>
    EDITION_PUBLISHERS.map((publisher) => ({
      words: edition.label,
      publisher,
    })),
);

// the search whose turn it is: one after the other, round and round, by the
// run's number (the job's runs since the epoch), so no state is kept
export const searchInTurn = (run: number) =>
  EDITION_SEARCHES[
    ((run % EDITION_SEARCHES.length) + EDITION_SEARCHES.length) %
      EDITION_SEARCHES.length
  ]!;

// the series an edition's book is of: "Naruto (3-in-1 Edition), Vol. 4:
// Includes vols. 10, 11 & 12" is Naruto's. Null for a book that names no
// edition (the search found a plain volume), a box set, or a light novel
export function seriesOfEditionBook(title: string): string | null {
  if (!editionOfTitle(title) || isSetOfBooks(title)) return null;
  const name = seriesOfBook(title.split(":")[0]!).trim();
  if (normalize(name).length < 2 || isNovelName(name)) return null;
  return name;
}

// the series in a search's books that we don't know yet, each once, in the
// order found. `known`: every known series' names, normalized
export function newSeriesIn(titles: string[], known: Set<string>): string[] {
  const found = new Map<string, string>();
  for (const title of titles) {
    const name = seriesOfEditionBook(title);
    if (!name) continue;
    const key = normalize(name);
    if (!known.has(key) && !found.has(key)) found.set(key, name);
  }
  return [...found.values()];
}
