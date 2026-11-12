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

// what's left of a line for someone who owns these volumes
export function editionPlan(line: EditionLine, owned: number[]) {
  const has = new Set(owned);
  const books: PlannedBook[] = line.books.map((b) => ({
    ...b,
    have: b.volumes.filter((v) => has.has(v)).length,
  }));
  const whole = (b: PlannedBook) => b.have === b.volumes.length;
  // the books the catalog lists end here: past it is worked out, and may not
  // be out yet
  const lastListed = books.reduce((at, b, i) => (b.listed ? i : at), -1);
  const out = books.slice(0, lastListed + 1);
  // the furthest book they have all of: a book they own one volume of (a
  // single bought before switching) is still theirs to buy next
  const furthest = out.reduce((at, b, i) => (whole(b) ? i : at), -1);
  const next = out.slice(furthest + 1).find((b) => !whole(b)) ?? null;
  // behind that: books they lack, or own only some volumes of
  const gaps = out.slice(0, furthest + 1).filter((b) => !whole(b));
  const left = out.filter((b) => !whole(b));
  const priced = left.filter((b) => b.knownPriceCents != null);
  return {
    next,
    gaps,
    left,
    ownedBooks: out.filter(whole).length,
    outBooks: out.length,
    // books past the last listed one: to come, or not in the catalog yet
    later: books.length - out.length,
    // at the last checked prices, for the ones that have one
    pricedCents: priced.reduce((sum, b) => sum + (b.knownPriceCents ?? 0), 0),
    pricedCount: priced.length,
    caughtUp: out.length > 0 && left.length === 0,
  };
}
export type EditionPlan = ReturnType<typeof editionPlan>;

// the line they seem to collect, from the books they've recorded: the one
// whose books match theirs, when those cover at least half of what they own
export function guessEdition(
  lines: EditionLine[],
  books: Pick<OwnedBook, "edition" | "volumes">[],
  owned: number[],
): string | null {
  if (!lines.length || !owned.length) return null;
  const mine = books.filter((b) => b.edition !== "single");
  let best: { key: string; covered: number } | null = null;
  for (const line of lines) {
    const sets = new Set(line.books.map((b) => b.volumes.join()));
    const covered = mine
      // a deluxe book points to a deluxe line, never an omnibus of the same size
      .filter((b) => b.edition === line.kind && sets.has(b.volumes.join()))
      .reduce((sum, b) => sum + b.volumes.length, 0);
    if (covered > (best?.covered ?? 0)) best = { key: line.key, covered };
  }
  return best && best.covered * 2 >= owned.length ? best.key : null;
}
