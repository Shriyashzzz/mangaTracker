// The stamp on a shelf card: the edition they own most of a series in, and
// how many other editions sit beside it ("Definitive +2"). Worked out from
// the books they own (each one's edition is read from its own title, by the
// one list in editionNames.ts) and the volumes ticked by hand, which are
// single volumes with no book behind them.
//
// A series owned mostly as single volumes gets no stamp: that's how most are
// collected, and a stamp on every card would say nothing.
import { editionOfTitle } from "../../prices/stores/match.js";

type Book = { title: string | null; edition: string; volumes: number[] };

export type EditionStamp = {
  // "Definitive", "Deluxe", "Box set"
  label: string;
  // "DEF", "DLX": for a compact row's small cover
  short: string;
  // other editions of the series they also own books of
  more: number;
};

// the kinds a book is saved as (util/shelf/ownedBooks.ts), for one whose
// title names no edition from the list
const KIND_NAMES: Record<string, { label: string; short: string }> = {
  omnibus: { label: "Omnibus", short: "OMNI" },
  deluxe: { label: "Deluxe", short: "DLX" },
  boxset: { label: "Box set", short: "BOX" },
};

// a book's edition as the app says it: "Definitive", "VIZBIG", "Box set";
// null for a single volume
export function editionOfBook(book: Pick<Book, "title" | "edition">) {
  // a box set is a box set, whatever edition its title also names
  if (book.edition === "boxset") return KIND_NAMES.boxset!;
  // (never a word in the middle of the series' own name: editionOfTitle)
  const named = editionOfTitle(book.title ?? "");
  if (named) return { label: named.label, short: named.short };
  return KIND_NAMES[book.edition] ?? null;
}

// `books`: the ones they still have (every volume of each is owned).
// `owned`: every volume they own of the series
export function editionStamp(
  books: Book[],
  owned: Iterable<number>,
): EditionStamp | null {
  const SINGLES = "single volumes";
  const count = new Map<string, number>();
  const names = new Map<string, { label: string; short: string }>();
  const inABook = new Set<number>();
  for (const book of books) {
    const edition = editionOfBook(book);
    const key = edition?.label ?? SINGLES;
    if (edition) names.set(key, edition);
    count.set(key, (count.get(key) ?? 0) + 1);
    for (const volume of book.volumes) inABook.add(volume);
  }
  // ticked by hand: a single volume each
  for (const volume of owned)
    if (!inABook.has(volume)) count.set(SINGLES, (count.get(SINGLES) ?? 0) + 1);

  // the edition with the most books; single volumes win a tie (no stamp)
  let most: string | null = null;
  for (const [key, books] of count) {
    if (key === SINGLES) continue;
    if (most === null || books > count.get(most)!) most = key;
  }
  if (most === null || count.get(most)! <= (count.get(SINGLES) ?? 0))
    return null;
  const { label, short } = names.get(most)!;
  // on a cover the word "Edition" is dropped: "Collector's", "Perfect"
  return {
    label: label.replace(/\s+edition$/i, ""),
    short,
    more: count.size - 1,
  };
}
