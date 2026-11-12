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

type Found = {
  number: number | null;
  volumes: number[] | null;
  isbn13: string;
  title: string;
  pages: number | null;
};

// the lines a series has, from its catalog records. `total`: the last volume
// out as a single, where known; no book holds a volume past it
export function buildEditionLines(
  name: string,
  docs: EditionDoc[],
  total: number | null,
): EditionLine[] {
  const byLine = new Map<string, Found[]>();
  for (const doc of docs) {
    const title = doc.title.trim();
    if (!TRADE_ISBN.test(doc.isbn13) || !isOf(title, name)) continue;
    if (NOT_ONE_BOOK.test(title)) continue;
    if (
      doc.publishers?.length &&
      doc.publishers.every((p) => SELF_PUBLISHED.test(p.trim()))
    )
      continue;
    const stated = omnibusVolumes(title);
    const bare = title.match(BARE_RANGE);
    const range =
      stated?.length && stated.length <= MOST_IN_ONE_BOOK
        ? stated
        : bare &&
            Number(bare[2]) > Number(bare[1]) &&
            Number(bare[2]) - Number(bare[1]) < MOST_IN_ONE_BOOK
          ? run(Number(bare[1]), Number(bare[2]))
          : null;
    const line =
      LINES.find((l) => l.words.test(title)) ??
      // no line named: a book holding two or three is that size's line
      (range && range.length <= 3
        ? LINES.find((l) => l.key === `${range.length}in1`)
        : undefined);
    if (!line) continue;
    const number =
      numberOf(title, Boolean(range)) ??
      // a bare range says its place: 4-6 is the second book of threes
      (range ? Math.ceil(range.at(-1)! / range.length) : null);
    if (number == null) continue;
    const table = range ? null : editionVolumes(name, title, number);
    const list = byLine.get(line.key) ?? [];
    list.push({
      number,
      volumes: range ?? table,
      isbn13: doc.isbn13,
      title,
      pages: doc.pages ?? null,
    });
    byLine.set(line.key, list);
  }

  const lines: EditionLine[] = [];
  for (const [key, found] of byLine) {
    const line = LINES.find((l) => l.key === key)!;
    // one record a number: the one that says its volumes, else the first
    const byNumber = new Map<number, Found>();
    for (const f of found.sort((a, b) => a.isbn13.localeCompare(b.isbn13))) {
      const had = byNumber.get(f.number!);
      if (!had || (!had.volumes && f.volumes)) byNumber.set(f.number!, f);
    }
    const known = [...byNumber.values()].filter((f) => f.volumes);
    const size =
      usualSize(known.map((f) => f.volumes!.length)) ??
      line.perBook ??
      // an omnibus as long as three volumes holds three
      (line.kind === "omnibus" &&
      [...byNumber.values()].some((f) => (f.pages ?? 0) >= THREE_VOLUME_PAGES)
        ? 3
        : null);
    const last = Math.max(...byNumber.keys());
    // through the last book found, then on to the series' end when the line's
    // size is known: an unlisted book is still the next one to look for
    const upTo = size && total ? Math.max(last, Math.ceil(total / size)) : last;
    const books: EditionBook[] = [];
    for (let n = 1; n <= Math.min(upTo, MOST_BOOKS); n++) {
      const f = byNumber.get(n);
      let volumes = f?.volumes ?? null;
      if (!volumes) {
        // between its neighbours, when they say where they end and start
        const before = books.at(-1)?.volumes.at(-1) ?? (n === 1 ? 0 : null);
        const after = byNumber.get(n + 1)?.volumes?.[0] ?? null;
        if (before != null && after != null && after - before - 1 >= 1)
          volumes =
            after - before - 1 <= MOST_IN_ONE_BOOK
              ? run(before + 1, after - 1)
              : null;
        else if (size && before != null)
          volumes = run(before + 1, before + size);
        else if (size) volumes = run((n - 1) * size + 1, n * size);
      }
      if (!volumes) continue;
      const kept = total ? volumes.filter((v) => v <= total) : volumes;
      if (!kept.length) continue;
      books.push({
        number: n,
        volumes: kept,
        isbn13: f?.isbn13 ?? null,
        title: f?.title ?? null,
        listed: Boolean(f),
      });
    }
    // worth offering only when the catalog really has some of it
    if (books.filter((b) => b.listed).length >= 1 && books.length >= 2)
      lines.push({ key, kind: line.kind, label: line.label, books });
  }

  // "Omnibus Edition" and "3-in-1 Edition" are one line under two names:
  // the same books, so the one with more ISBNs stays and takes the other's
  const listedCount = (l: EditionLine) =>
    l.books.filter((b) => b.listed).length;
  const kept: EditionLine[] = [];
  for (const line of lines.sort((a, b) => listedCount(b) - listedCount(a))) {
    const same = kept.find(
      (k) =>
        k.kind === line.kind &&
        k.books[0]!.volumes.join() === line.books[0]!.volumes.join(),
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
