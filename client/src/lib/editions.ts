// A series' other editions, and what a reader collecting one still needs:
// "Deluxe 3 (vols. 7–9)" and not three paperbacks. The lines come from the
// server (prices/editionLines.ts); everything here is worked out from a line
// and the volumes they own, however they came to own them.
import type { OwnedBook } from "./books";
import { rangesText } from "./ownedVolumes";

export type EditionBook = {
  number: number;
  volumes: number[];
  isbn13: string | null;
  title: string | null;
  // in the catalog, with an ISBN; false: worked out from the line
  listed: boolean;
  knownPriceCents?: number | null;
};
export type EditionLine = {
  key: string;
  kind: "omnibus" | "deluxe";
  label: string;
  books: EditionBook[];
};

// "Deluxe 3 (vols. 7–9)"
export const editionBookLabel = (line: EditionLine, book: EditionBook) =>
  `${line.label} ${book.number}`;
export const insideText = (book: EditionBook) =>
  `${book.volumes.length === 1 ? "vol." : "vols."} ${rangesText(book.volumes)}`;

// a book of the line beside what they own of it
export type PlannedBook = EditionBook & {
  // how many of its volumes they own already, in any edition
  have: number;
};

// the place of the last item that passes the test, or -1
const lastIndexWhere = <T>(list: T[], passes: (item: T) => boolean) => {
  for (let i = list.length - 1; i >= 0; i--) if (passes(list[i]!)) return i;
  return -1;
};

// what's left of a line for someone who owns these volumes
export function editionPlan(line: EditionLine, owned: number[]) {
  const ownedVolumes = new Set(owned);
  const books: PlannedBook[] = line.books.map((book) => ({
    ...book,
    have: book.volumes.filter((v) => ownedVolumes.has(v)).length,
  }));
  // they own every volume inside it
  const isOwned = (book: PlannedBook) => book.have === book.volumes.length;

  // "out": the books up to the last one the catalog lists. Past that a book
  // is only worked out from the line, and may not be published yet
  const lastListed = lastIndexWhere(books, (book) => book.listed);
  const out = books.slice(0, lastListed + 1);
  const later = books.length - out.length;

  // the furthest book they have all of. A book they own one volume of (a
  // single bought before switching) is still theirs to buy
  const furthestOwned = lastIndexWhere(out, isOwned);
  const upToFurthest = out.slice(0, furthestOwned + 1);
  const pastFurthest = out.slice(furthestOwned + 1);

  const next = pastFurthest.find((book) => !isOwned(book)) ?? null;
  // behind the furthest: books they lack, or own only some volumes of
  const gaps = upToFurthest.filter((book) => !isOwned(book));
  const left = out.filter((book) => !isOwned(book));

  // at the last checked prices, for the ones that have one
  const priced = left.filter((book) => book.knownPriceCents != null);
  let pricedCents = 0;
  for (const book of priced) pricedCents += book.knownPriceCents ?? 0;

  return {
    next,
    gaps,
    left,
    ownedBooks: out.filter(isOwned).length,
    outBooks: out.length,
    // books past the last listed one: to come, or not in the catalog yet
    later,
    pricedCents,
    pricedCount: priced.length,
    caughtUp: out.length > 0 && left.length === 0,
  };
}
export type EditionPlan = ReturnType<typeof editionPlan>;

type RecordedBook = Pick<OwnedBook, "edition" | "volumes">;

// how many of their volumes sit in books that are this line's own: a recorded
// "Deluxe" book holding 4–6 matches a deluxe line with a book holding 4–6. A
// deluxe book never points to an omnibus line of the same size
function volumesInLine(line: EditionLine, recorded: RecordedBook[]) {
  const lineBooks = new Set(line.books.map((book) => book.volumes.join()));
  let volumes = 0;
  for (const book of recorded) {
    const sameKind = book.edition === line.kind;
    if (sameKind && lineBooks.has(book.volumes.join()))
      volumes += book.volumes.length;
  }
  return volumes;
}

// the line they seem to collect, from the books they've recorded: the one
// whose books match theirs, when those cover at least half of what they own
export function guessEdition(
  lines: EditionLine[],
  books: RecordedBook[],
  owned: number[],
): string | null {
  if (!lines.length || !owned.length) return null;
  const recorded = books.filter((book) => book.edition !== "single");

  let bestKey: string | null = null;
  let bestVolumes = 0;
  for (const line of lines) {
    const volumes = volumesInLine(line, recorded);
    if (volumes > bestVolumes) {
      bestKey = line.key;
      bestVolumes = volumes;
    }
  }
  const atLeastHalf = bestVolumes * 2 >= owned.length;
  return atLeastHalf ? bestKey : null;
}

// ---------- asking for an edition by name ----------

// the words a search uses for an edition, and the line they mean
const ASKED: [RegExp, string][] = [
  [/\bdeluxe(\s+edition)?\b/i, "deluxe"],
  [/\bperfect\s+edition\b/i, "perfect"],
  [/\bcollector'?s\s+edition\b/i, "collectors"],
  [/\bmaster\s+edition\b/i, "master"],
  [/\bfullmetal\s+edition\b/i, "fullmetal"],
  [/\bblack\s+edition\b/i, "black"],
  [/\bultimate\s+edition\b/i, "ultimate"],
  [/\bvizbig(\s+edition)?\b/i, "vizbig"],
  [/\b3\s*-?\s*in\s*-?\s*1(\s+edition)?\b/i, "3in1"],
  [/\b2\s*-?\s*in\s*-?\s*1(\s+edition)?\b/i, "2in1"],
  [/\bomnibus(\s+edition)?\b/i, "omnibus"],
];

// "berserk deluxe" is the series "berserk" and its deluxe line. A search
// that's only the word ("omnibus") is left as typed
export function askedEdition(query: string): {
  series: string;
  edition: string | null;
} {
  for (const [words, edition] of ASKED) {
    if (!words.test(query)) continue;
    const series = query.replace(words, " ").replace(/\s+/g, " ").trim();
    if (series.length >= 2) return { series, edition };
  }
  return { series: query, edition: null };
}

// the line an asked-for edition means: its own, or else one of its kind
// ("omnibus" finds a series' 3-in-1 books)
const KIND_OF: Record<string, EditionLine["kind"]> = {
  deluxe: "deluxe",
  perfect: "deluxe",
  collectors: "deluxe",
  master: "deluxe",
  fullmetal: "deluxe",
};
export function lineFor(lines: EditionLine[], asked: string | null) {
  if (!asked) return null;
  const itsOwn = lines.find((line) => line.key === asked);
  if (itsOwn) return itsOwn;
  const kind = KIND_OF[asked] ?? "omnibus";
  return lines.find((line) => line.kind === kind) ?? null;
}

// the line worth the spot: a deluxe one before an omnibus
export const headlineLine = (lines: EditionLine[]) =>
  lines.find((l) => l.kind === "deluxe") ?? lines[0] ?? null;
