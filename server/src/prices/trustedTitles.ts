// How a trusted list's title is read (scripts/loadTrustedBooks.ts): which
// series, which volume, and what kind of book, read the way the site reads
// titles (stores/match.ts) once a list's own habits are undone. Kept here,
// not in the script, so its tests can reach it
import {
  editionOfTitle,
  isNovelBook,
  seriesName,
  seriesOfBook,
  volumeOf,
} from "./stores/match.js";

export type TrustedKind = "single" | "edition" | "novel" | "oneshot";
export type ReadTitle = {
  kind: TrustedKind;
  series: string;
  volume: number | null;
  // the volumes an edition book holds, only when its title says
  holds: number[];
  // as the site would name it: "Rebirth, Vol. 3"
  title: string;
  // an edition book's line and number in it ("2in1", 19)
  edition?: { key: string; number: number };
};

const NOVEL = /\bthe novel\b|\(novel\)|\blight novel\b/i;
const NOVEL_WORDS = /\s*[:,-]?\s*(\bthe novel\b|\(novel\)|\blight novel\b)/i;

// What one of the list's titles is, read the way the site reads titles
// (stores/match.ts), after a list's own habits are undone:
//   "Way of the Househusband, The - Vol. 01"  Libib's sorting name (and
//   "A Devil and Her Love Song" as "Devil and Her Love Song, A -")
//   "Rizelmine (v. 1)"                        a number only in "(v. N)"
export function readTitle(raw: string): ReadTitle {
  let t = raw
    .replace(/^(.+?),\s*(The|An|A)\s*-\s*(?=Vol)/i, "$2 $1, ")
    .replace(/\s+/g, " ")
    .trim();
  const vOnly = t.match(/\(v\.\s*(\d+)\)/i);
  if (vOnly && Number.isNaN(volumeOf(t)))
    t = `${seriesName(t.replace(/\(v\.\s*\d+\)/i, ""))}, Vol. ${vOnly[1]}`;

  if (NOVEL.test(t) || isNovelBook(t)) {
    const series = seriesName(t).replace(NOVEL_WORDS, "").trim();
    const n = volumeOf(t);
    return {
      kind: "novel",
      series,
      volume: Number.isInteger(n) && n >= 1 ? n : null,
      holds: [],
      title: Number.isInteger(n) ? `${series} Light Novel, Vol. ${n}` : t,
    };
  }

  const edition = editionOfTitle(t);
  if (edition || /\bedition\b/i.test(t)) {
    const series = seriesOfBook(t);
    // what it holds, only when the title says: "Vol. 37 & 38", "2-in-1 of
    // Volumes 27 & 28"
    const pair =
      t.match(/volumes?\s+(\d+)\s*(?:&|and|-|–)\s*(\d+)/i) ??
      t.match(/vol\.?\s*(\d+)\s*(?:&|and)\s*(\d+)/i);
    const from = pair ? Number(pair[1]) : NaN;
    const to = pair ? Number(pair[2]) : NaN;
    const holds =
      pair && from >= 1 && to >= from && to - from < 10
        ? Array.from({ length: to - from + 1 }, (_, i) => from + i)
        : [];
    // its own number: "(2-in-1 Vol. 19)", else the title's
    const own = t.match(/\d-in-1\s+vol\.?\s*(\d+)/i);
    const number = own ? Number(own[1]) : volumeOf(t);
    return {
      kind: "edition",
      series,
      volume: null,
      holds,
      title: t,
      ...(edition && Number.isInteger(number)
        ? { edition: { key: edition.key, number } }
        : {}),
    };
  }

  const n = volumeOf(t);
  const series = seriesName(t);
  if (Number.isInteger(n) && n >= 1 && series)
    return {
      kind: "single",
      series,
      volume: n,
      holds: [],
      title: `${series}, Vol. ${n}`,
    };
  return {
    kind: "oneshot",
    series: series || t,
    volume: null,
    holds: [],
    title: t,
  };
}
