// A series' other editions, book by book: "Berserk Deluxe 2 holds vols 4 to
// 6, ISBN …". For a reader collecting the deluxe books, who shouldn't be told
// to buy thirty paperbacks.
//
// What a catalog says is patchy, so a line is put together from everything
// that helps, most trusted first:
//   1. a title that states its volumes ("Omnibus 1 (Vol. 1-3)", "Includes
//      vols. 1, 2 & 3", a work titled "Naruto #1-3")
//   2. the hand-kept table of uneven editions (util/shelf/editions.ts)
//   3. the books either side of it (Omnibus 6 sits between 13-15 and 19-21)
//   4. the line's own size ("3-in-1", or what its other books hold)
// A book the catalog doesn't list is still worked out, without an ISBN, so
// the line has no holes; it's marked unlisted and the page links a search.
import { editionVolumes } from "../util/shelf/editions.js";
import { normalize, omnibusVolumes } from "./stores/match.js";

export type EditionBook = {
  // its number in the edition: Deluxe 2
  number: number;
  // the series' volumes it holds
  volumes: number[];
  isbn13: string | null;
  title: string | null;
  // in the catalog, with an ISBN; false: worked out from the line
  listed: boolean;
};

export type EditionLine = {
  // "deluxe", "3in1", "omnibus": what a shelf entry saves as its edition
  key: string;
  kind: "omnibus" | "deluxe";
  label: string;
  books: EditionBook[];
};

// a catalog record, as much of it as a line needs
export type EditionDoc = {
  title: string;
  isbn13: string;
  publishers?: string[];
  pages?: number | null;
};

// the words that name a line, most specific first
const LINES: {
  key: string;
  kind: EditionLine["kind"];
  label: string;
  words: RegExp;
  perBook?: number;
}[] = [
  { key: "deluxe", kind: "deluxe", label: "Deluxe", words: /\bdeluxe\b/i },
  {
    key: "perfect",
    kind: "deluxe",
    label: "Perfect Edition",
    words: /\bperfect\s+edition\b/i,
  },
  {
    key: "collectors",
    kind: "deluxe",
    label: "Collector's Edition",
    words: /\bcollector'?s\s+edition\b/i,
  },
  {
    key: "master",
    kind: "deluxe",
    label: "Master Edition",
    words: /\bmaster\s+edition\b/i,
  },
  {
    key: "fullmetal",
    kind: "deluxe",
    label: "Fullmetal Edition",
    words: /\bfullmetal\s+edition\b/i,
  },
  {
    key: "black",
    kind: "omnibus",
    label: "Black Edition",
    words: /\bblack\s+edition\b/i,
    perBook: 2,
  },
  {
    key: "ultimate",
    kind: "omnibus",
    label: "Ultimate Edition",
    words: /\bultimate\s+edition\b/i,
    perBook: 2,
  },
  {
    key: "vizbig",
    kind: "omnibus",
    label: "VIZBIG",
    words: /\bvizbig\b/i,
    perBook: 3,
  },
  {
    key: "3in1",
    kind: "omnibus",
    label: "3-in-1",
    words: /\b3\s*-?\s*in\s*-?\s*1\b/i,
    perBook: 3,
  },
  {
    key: "2in1",
    kind: "omnibus",
    label: "2-in-1",
    words: /\b2\s*-?\s*in\s*-?\s*1\b/i,
    perBook: 2,
  },
  { key: "omnibus", kind: "omnibus", label: "Omnibus", words: /\bomnibus\b/i },
];

// third-party bundles and rebinds borrow a line's name: never the publisher's
const NOT_ONE_BOOK =
  /\b(box(ed)?\s*set|books?\s+collection|collection\s+set|bundle|lot|notebook|colou?ring|journal|planner|calendar|art\s*book|guide)\b/i;
const SELF_PUBLISHED = /^(independently published|createspace|lulu)/i;
// US trade ISBNs; 979-8 is where print-on-demand copies live
const TRADE_ISBN = /^978[01]\d{9}$/;
// a manga volume runs to about 250 pages; a book this long holds three
const THREE_VOLUME_PAGES = 500;
const MOST_IN_ONE_BOOK = 5;
const MOST_BOOKS = 80;

// "#1-3", "1‐2", "Vol. 1-3" at the end of a title that names no line: a book
// holding that run
const BARE_RANGE = /(?:#|\bvols?\.?\s*)?(\d{1,3})\s*[‐\-–]\s*(\d{1,3})\s*$/i;

// the title up to where it starts listing what's inside
const headOf = (title: string) =>
  title
    .replace(/\((?:vols?\.?|volumes?|includes)[^)]*\)/gi, " ")
    .split(/:\s|\bincludes\b/i)[0]!;

// the book's number in its line: "Deluxe Volume 2", "Omnibus 34", "(Omnibus
// Edition), Vol. 1", "Deluxe, Book 7"
const numberOf = (title: string, hasRange: boolean) => {
  const head = headOf(title);
  const said =
    head.match(
      /(?:\bvol(?:ume)?\.?|\bbook|\bomnibus|\bdeluxe|\bedition\)?,?|#)\s*(\d{1,3})\b(?!\s*[‐\-–]\s*\d)/i,
    )?.[1] ??
    // a number ending the title, unless that's the end of a range ("#1-3")
    (hasRange ? undefined : head.match(/\b(\d{1,3})\s*$/)?.[1]);
  const n = Number(said);
  return said && n >= 1 && n <= MOST_BOOKS ? n : null;
};

// the title is this series' own: its name, then the line's words, with
// nothing else in between ("One Piece: Ace's Story Omnibus" is another book)
const isOf = (title: string, name: string) => {
  const t = normalize(title);
  const n = normalize(name);
  if (t !== n && !t.startsWith(`${n} `)) return false;
  const rest = t.slice(n.length).trim();
  return /^(the\s+)?(\d|#|vol|book|deluxe|perfect|collectors?|master|fullmetal|black|ultimate|vizbig|omnibus|[23]\s*in\s*1|edition)/.test(
    rest,
  );
};

const run = (from: number, to: number) =>
  Array.from({ length: to - from + 1 }, (_, i) => from + i);

// the most common size among the books that say theirs
const usualSize = (sizes: number[]) => {
  const counts = new Map<number, number>();
  for (const s of sizes) counts.set(s, (counts.get(s) ?? 0) + 1);
  return [...counts].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0]?.[0] ?? null;
};

// a catalog record read as a book of a line
type Found = {
  // its number in the line
  number: number;
  // the volumes inside, when the title or the hand-kept table says
  volumes: number[] | null;
  isbn13: string;
  title: string;
  pages: number | null;
};
type LineKind = (typeof LINES)[number];

// a publisher's own book of this series, not a bundle or a reprint
function isPublishersBook(doc: EditionDoc, name: string) {
  const title = doc.title.trim();
  if (!TRADE_ISBN.test(doc.isbn13)) return false;
  if (!isOf(title, name)) return false;
  if (NOT_ONE_BOOK.test(title)) return false;
  const publishers = doc.publishers ?? [];
  const allSelfPublished =
    publishers.length > 0 &&
    publishers.every((p) => SELF_PUBLISHED.test(p.trim()));
  return !allSelfPublished;
}

// the volumes a title states: "Omnibus 1 (Vol. 1-3)", or a bare "#1-3" at
// its end. Null when it says none, or more than one book could hold
function statedVolumes(title: string): number[] | null {
  const stated = omnibusVolumes(title);
  if (stated?.length && stated.length <= MOST_IN_ONE_BOOK) return stated;
  const bare = title.match(BARE_RANGE);
  if (!bare) return null;
  const from = Number(bare[1]);
  const to = Number(bare[2]);
  const isARun = to > from && to - from < MOST_IN_ONE_BOOK;
  return isARun ? run(from, to) : null;
}

// the line a title belongs to: the one it names, or, naming none, the
// 2-in-1 or 3-in-1 line when it holds two or three volumes
function lineOfTitle(title: string, volumes: number[] | null) {
  const named = LINES.find((line) => line.words.test(title));
  if (named) return named;
  if (volumes && volumes.length <= 3)
    return LINES.find((line) => line.key === `${volumes.length}in1`);
  return undefined;
}

// one catalog record as a book of a line, or null when it isn't one
function readDoc(
  doc: EditionDoc,
  name: string,
): { line: LineKind; found: Found } | null {
  if (!isPublishersBook(doc, name)) return null;
  const title = doc.title.trim();
  const stated = statedVolumes(title);
  const line = lineOfTitle(title, stated);
  if (!line) return null;

  let number = numberOf(title, Boolean(stated));
  // a bare range says its place: 4-6 is the second book of threes
  if (number === null && stated)
    number = Math.ceil(stated.at(-1)! / stated.length);
  if (number === null) return null;

  // the title's own word first, then the hand-kept table of uneven editions
  const volumes = stated ?? editionVolumes(name, title, number);
  const found = {
    number,
    volumes,
    isbn13: doc.isbn13,
    title,
    pages: doc.pages ?? null,
  };
  return { line, found };
}

// one record for each number: the one that says its volumes, else the first
// by ISBN
function oneForEachNumber(found: Found[]) {
  const byNumber = new Map<number, Found>();
  const inIsbnOrder = [...found].sort((a, b) =>
    a.isbn13.localeCompare(b.isbn13),
  );
  for (const record of inIsbnOrder) {
    const had = byNumber.get(record.number);
    const saysMore = had && !had.volumes && record.volumes;
    if (!had || saysMore) byNumber.set(record.number, record);
  }
  return byNumber;
}

// how many volumes a book of this line usually holds, or null when nothing
// says: what most of its books state, else the line's own size ("3-in-1"),
// else three for an omnibus as long as three volumes
function sizeOfLine(line: LineKind, records: Found[]) {
  const statedSizes = records
    .filter((record) => record.volumes)
    .map((record) => record.volumes!.length);
  const usual = usualSize(statedSizes);
  if (usual) return usual;
  if (line.perBook) return line.perBook;
  const isLong = records.some(
    (record) => (record.pages ?? 0) >= THREE_VOLUME_PAGES,
  );
  return line.kind === "omnibus" && isLong ? 3 : null;
}

// the volumes of a book that doesn't say its own, worked out from the books
// either side of it, or from the line's size
function workedOutVolumes(
  number: number,
  // the last volume of the book before it; null when that isn't known
  endOfPrevious: number | null,
  // the first volume of the book after it; null when that isn't known
  startOfNext: number | null,
  size: number | null,
): number[] | null {
  const gap =
    endOfPrevious !== null && startOfNext !== null
      ? startOfNext - endOfPrevious - 1
      : 0;
  // between its neighbours, when they say where they end and start
  if (gap >= 1)
    return gap <= MOST_IN_ONE_BOOK
      ? run(endOfPrevious! + 1, startOfNext! - 1)
      : null;
  if (!size) return null;
  // straight after the book before it
  if (endOfPrevious !== null)
    return run(endOfPrevious + 1, endOfPrevious + size);
  // by its place in the line: book 2 of threes holds 4 to 6
  return run((number - 1) * size + 1, number * size);
}

// a line's books in order, from the records found for it. A book the catalog
// doesn't list is still worked out, so the line has no holes
function booksOfLine(line: LineKind, found: Found[], total: number | null) {
  const byNumber = oneForEachNumber(found);
  const size = sizeOfLine(line, [...byNumber.values()]);
  const lastFound = Math.max(...byNumber.keys());
  // through the last book found, then on to the series' end when the line's
  // size is known: an unlisted book is still the next one to look for
  const lastOfSeries = size && total ? Math.ceil(total / size) : 0;
  const lastNumber = Math.min(Math.max(lastFound, lastOfSeries), MOST_BOOKS);

  const books: EditionBook[] = [];
  for (let number = 1; number <= lastNumber; number++) {
    const record = byNumber.get(number);
    const previous = books.at(-1);
    const endOfPrevious = previous?.volumes.at(-1) ?? (number === 1 ? 0 : null);
    const startOfNext = byNumber.get(number + 1)?.volumes?.[0] ?? null;
    const volumes =
      record?.volumes ??
      workedOutVolumes(number, endOfPrevious, startOfNext, size);
    if (!volumes) continue;
    // no book holds a volume past the series' last
    const withinSeries = total ? volumes.filter((v) => v <= total) : volumes;
    if (!withinSeries.length) continue;
    books.push({
      number,
      volumes: withinSeries,
      isbn13: record?.isbn13 ?? null,
      title: record?.title ?? null,
      listed: Boolean(record),
    });
  }
  return books;
}

const listedCount = (line: EditionLine) =>
  line.books.filter((book) => book.listed).length;

// "Omnibus Edition" and "3-in-1 Edition" are one line under two names: the
// same books. The one with more ISBNs stays, and takes any book the other
// has an ISBN for
function mergeSameLines(lines: EditionLine[]) {
  const kept: EditionLine[] = [];
  const mostListedFirst = [...lines].sort(
    (a, b) => listedCount(b) - listedCount(a),
  );
  for (const line of mostListedFirst) {
    const firstBook = line.books[0]!.volumes.join();
    const same = kept.find(
      (other) =>
        other.kind === line.kind &&
        other.books[0]!.volumes.join() === firstBook,
    );
    if (!same) {
      kept.push(line);
      continue;
    }
    for (const book of line.books) {
      const at = same.books.findIndex((b) => b.number === book.number);
      if (at < 0) same.books.push(book);
      else if (!same.books[at]!.listed && book.listed) same.books[at] = book;
    }
    same.books.sort((a, b) => a.number - b.number);
  }
  return kept;
}

// the lines a series has, from its catalog records. `total`: the last volume
// out as a single, where known; no book holds a volume past it
export function buildEditionLines(
  name: string,
  docs: EditionDoc[],
  total: number | null,
): EditionLine[] {
  // every record that's a book of a line, grouped by line
  const foundByLine = new Map<LineKind, Found[]>();
  for (const doc of docs) {
    const read = readDoc(doc, name);
    if (!read) continue;
    const list = foundByLine.get(read.line) ?? [];
    list.push(read.found);
    foundByLine.set(read.line, list);
  }

  const lines: EditionLine[] = [];
  for (const [line, found] of foundByLine) {
    const books = booksOfLine(line, found, total);
    // worth offering only when the catalog really has some of it
    const hasAListedBook = books.some((book) => book.listed);
    if (hasAListedBook && books.length >= 2)
      lines.push({ key: line.key, kind: line.kind, label: line.label, books });
  }
  return mergeSameLines(lines);
}
