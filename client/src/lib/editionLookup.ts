// "Which book has my volume?": a volume number, answered in every edition a
// series has at once ("VIZBIG 8 · vols. 22–24", "Definitive 8 · vols.
// 22–24"). The same for the /editions page (its saved lines) and a series
// page's Other editions (its lines): one rule, said in the app's own words
// (bookName, insideText). Pure, so the server's Jest tests it.
import { bookName } from "./bookName";
import { insideText } from "./editions";

// a line as the lookup needs it: the series page's EditionLine fits as it is
export type LookupLine = {
  key: string;
  label: string;
  books: { number: number; volumes: number[] }[];
};

export type LookupAnswer = {
  line: LookupLine;
  // the book holding the volume: "VIZBIG 8", and what it holds; null when no
  // book of this line does (past its end, or a gap no catalog lists)
  book: { name: string; inside: string } | null;
  // what the line runs, for a volume it doesn't hold: "vols. 1–36"
  runs: string;
};

export function lookUpVolume(
  lines: LookupLine[],
  volume: number,
): LookupAnswer[] {
  return lines.map((line) => {
    const book = line.books.find((b) => b.volumes.includes(volume));
    const all = line.books.flatMap((b) => b.volumes);
    return {
      line,
      book: book
        ? { name: bookName(line.label, book.number), inside: insideText(book) }
        : null,
      runs: insideText({ volumes: all }),
    };
  });
}

// the volume to ask about for someone with the series on their shelf: the
// one after the furthest they own, while any line still holds it
export function nextVolumeFor(lines: LookupLine[], owned: number[]) {
  if (!owned.length) return null;
  const next = Math.max(...owned) + 1;
  const held = lines.some((l) => l.books.some((b) => b.volumes.includes(next)));
  return held ? next : null;
}

// the index's spans (each book's first and last volume) as books
export const booksFromSpans = (
  spans: { number: number; from: number; to: number }[],
) =>
  spans.map((s) => ({
    number: s.number,
    volumes: Array.from({ length: s.to - s.from + 1 }, (_, i) => s.from + i),
  }));
