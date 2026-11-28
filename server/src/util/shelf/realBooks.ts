// A line's real books, in order: up to the last one a catalog lists or that
// is vouched for (`sure`: the hand table, or readers' reports, util/shelf/
// editionReports.ts), gaps between them included. Past that a book is only
// worked out from the line's pattern and isn't said to exist. A volume is in
// one book: should a catalog put one in two, the earlier keeps it.
// Kept in step with client/src/lib/editionShelf.ts realBooksOf
// (tests/shelf/rulesInStep.test.ts fails if the two differ)
export function realBooks<
  T extends { volumes: number[]; listed?: boolean; sure?: boolean },
>(books: T[]): T[] {
  const last = books.map((b) => Boolean(b.listed || b.sure)).lastIndexOf(true);
  const real = last < 0 ? books : books.slice(0, last + 1);
  const taken = new Set<number>();
  return real.filter((book) => {
    if (!book.volumes?.length) return false;
    if (book.volumes.some((v) => taken.has(v))) return false;
    for (const v of book.volumes) taken.add(v);
    return true;
  });
}

// THE books of a line that are on the shelf: its real books that are out.
// A book with a day still to come isn't, and ticking its volumes doesn't
// record it. `today` is "2026-11-19". Kept in step with client/src/lib/
// editionShelf.ts shelfBooksOf (tests/shelf/rulesInStep.test.ts), so a tick
// never records a book the shelf doesn't show
export function shelfBooks<
  T extends {
    volumes: number[];
    listed?: boolean;
    sure?: boolean;
    published?: string | null;
  },
>(books: T[], today: string): T[] {
  const comesLater = (book: T) =>
    /^\d{4}-\d{2}-\d{2}$/.test(book.published ?? "") && book.published! > today;
  return realBooks(books).filter((book) => !comesLater(book));
}
