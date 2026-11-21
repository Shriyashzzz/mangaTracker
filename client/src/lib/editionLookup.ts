// "Which book has my volume?": a volume number, answered in every edition a
// series has at once ("VIZBIG 8 · vols. 22–24", "Definitive 8 · vols.
// 22–24"). The same for the /editions page (its saved lines) and a series
// page's Other editions (its lines): one rule, said in the app's own words
// (bookName, insideText). Pure, so the server's Jest tests it.
//
// The books that count are the series page's own (lib/editionShelf.ts
// realBooksOf): every one up to the last a catalog lists or that is vouched
// for (the hand table, or readers' reports: server editionReports.ts), gaps
// between them included. Past that, a book worked out from the line's
// pattern isn't shown. One whose release date is still ahead is coming,
// drawn dashed.
import { bookName } from "./bookName";
import { insideText } from "./editions";
import { realBooksOf } from "./editionShelf";
import { notOutYet } from "./releaseDate";

export type LookupBook = {
  number: number;
  volumes: number[];
  // a catalog lists it (false: worked out from the line)
  listed?: boolean;
  // vouched for without a catalog: the hand table, or readers' reports
  sure?: boolean;
  // its release date ("2027-01-26", "2027-01"), when a catalog says
  published?: string | null;
};

// a line as the lookup needs it: the series page's EditionLine fits as it is
export type LookupLine = { key: string; label: string; books: LookupBook[] };

// "Jan 26, 2027" or, known only to the month, "Jan 2027"
export function comingText(published: string) {
  const [y, m, d] = published.split("-").map(Number);
  const date = new Date(y!, (m ?? 1) - 1, d || 1);
  return date.toLocaleDateString("en-US", {
    month: "short",
    ...(d ? { day: "numeric" } : {}),
    year: "numeric",
  });
}

// the books worth showing, each out or coming (with its date)
export function shownBooks(line: LookupLine, now = new Date()) {
  // a line nothing lists or vouches for is only worked out: nothing shows
  // (the series page's shelf still draws it, for a reader to tick theirs)
  if (!line.books.some((book) => book.listed || book.sure)) return [];
  return realBooksOf(line).map((book) => ({
    ...book,
    coming:
      book.published && notOutYet(book.published, now)
        ? comingText(book.published)
        : null,
  }));
}

export type LookupAnswer = {
  line: LookupLine;
  // the book holding the volume: "VIZBIG 8", what it holds, and its date when
  // it's still coming; null when no book of this line out or confirmed does
  book: { name: string; inside: string; coming: string | null } | null;
  // what the line's shown books run, for a volume none holds: "vols. 1–21"
  runs: string;
};

export function lookUpVolume(
  lines: LookupLine[],
  volume: number,
  now = new Date(),
): LookupAnswer[] {
  // a line with nothing out or confirmed has nothing to say
  return lines.flatMap((line) => {
    const books = shownBooks(line, now);
    if (!books.length) return [];
    const book = books.find((b) => b.volumes.includes(volume));
    const answer: LookupAnswer = {
      line,
      book: book
        ? {
            name: bookName(line.label, book.number),
            inside: insideText(book),
            coming: book.coming,
          }
        : null,
      runs: insideText({ volumes: books.flatMap((b) => b.volumes) }),
    };
    return [answer];
  });
}

// the volume to ask about for someone with the series on their shelf: the
// one after the furthest they own, while a shown book holds it
export function nextVolumeFor(lines: LookupLine[], owned: number[]) {
  if (!owned.length) return null;
  const next = Math.max(...owned) + 1;
  const held = lines.some((l) =>
    shownBooks(l).some((b) => b.volumes.includes(next)),
  );
  return held ? next : null;
}

// the index's spans (each book's first and last volume, whether it's listed
// or vouched for, and its date) as books
export const booksFromSpans = (
  spans: {
    number: number;
    from: number;
    to: number;
    listed?: boolean;
    sure?: boolean;
    published?: string | null;
  }[],
): LookupBook[] =>
  spans.map((s) => ({
    number: s.number,
    volumes: Array.from({ length: s.to - s.from + 1 }, (_, i) => s.from + i),
    listed: s.listed,
    sure: s.sure,
    published: s.published ?? null,
  }));

// what a line shows, for its facts: "9 books · 2 coming · vols. 1–27"
export function lineFacts(line: LookupLine, now = new Date()) {
  const books = shownBooks(line, now);
  const volumes = books.flatMap((b) => b.volumes);
  return {
    books: books.length,
    coming: books.filter((b) => b.coming).length,
    from: volumes.length ? Math.min(...volumes) : 0,
    to: volumes.length ? Math.max(...volumes) : 0,
  };
}
