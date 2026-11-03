// Reading a book app's export (Goodreads, Book Catalogue, or any CSV) in the
// browser, so the file never leaves their computer. Book apps list every volume
// as its own book; the shelf has one entry per series, so volumes are grouped by
// series first. Kept free of the DOM so it can be tested on its own.
import type { MalEntry } from "./malImport";

export type BookSource = "goodreads" | "bookcatalogue" | "csv";

// one row of the export, whatever app it came from
export type Book = {
  title: string;
  series: string;
  volume: number | null;
  owned: boolean;
  read: boolean;
  // reading it now: everything before it counts as read
  reading: boolean;
  // 1-5, 0 for not rated
  rating: number;
  // on a want-to-read list and nothing else
  planned: boolean;
};

export type BookSeries = {
  key: string;
  title: string;
  books: number;
  ownedVolumes: number;
  readVolumes: number;
  score: number;
  // nothing owned or read yet: only on a to-read list
  planned: boolean;
};

// ---------- CSV ----------

// RFC 4180: quoted fields can hold commas, quotes ("") and line breaks
export function parseCsv(text: string): string[][] {
  const clean = text.replace(/^\uFEFF/, "");
  const firstLine = clean.slice(0, clean.search(/\r?\n|$/));
  const delimiter = [",", ";", "\t"].reduce((best, d) =>
    firstLine.split(d).length > firstLine.split(best).length ? d : best,
  );
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < clean.length; i++) {
    const c = clean[i]!;
    if (quoted) {
      if (c === '"' && clean[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"' && field === "") quoted = true;
    else if (c === delimiter) {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && clean[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((cell) => cell.trim()));
}

// ---------- series and volume numbers ----------

// a special edition is still the same series: "Berserk Deluxe Edition" is Berserk
const EDITION =
  /[\s,:(\-–—]+(deluxe|omnibus|collector'?s|perfect|ultimate|master|complete|box ?set|\d-in-\d|\d+ ?in ?\d+)( edition)?\)?$/i;

const tidy = (name: string) =>
  name
    .replace(/\s+/g, " ")
    .replace(/[\s,:;.\-–—]+$/, "")
    .replace(EDITION, "")
    .replace(/[\s,:;.\-–—]+$/, "")
    .trim();

// some publishers spell it out: "Sex Criminals: Volume One"
const NUMBER_WORDS = [
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "ten",
  "eleven",
  "twelve",
];

// "One Piece, Vol. 1: Romance Dawn (One Piece, #1)" → One Piece, 1
// "Frieren: Beyond Journey's End, Vol. 3" → Frieren: Beyond Journey's End, 3
export function seriesFromTitle(title: string): {
  series: string;
  volume: number | null;
} {
  const tagged = title.match(/\(([^()]+?),?\s*#\s*(\d+(?:\.\d+)?)[^()]*\)\s*$/);
  if (tagged) return { series: tidy(tagged[1]!), volume: Number(tagged[2]) };
  const bare = title.replace(/\s*\([^()]*\)\s*$/, "");
  const numbered = bare.match(
    new RegExp(
      `^(.*?)(?:[,:]|\\s[-–—])?\\s+(?:vol(?:ume)?\\.?|v\\.|book|#)\\s*(\\d+(?:\\.\\d+)?|${NUMBER_WORDS.join("|")})\\b`,
      "i",
    ),
  );
  if (numbered && numbered[1]!.trim()) {
    const n = numbered[2]!.toLowerCase();
    const word = NUMBER_WORDS.indexOf(n);
    return {
      series: tidy(numbered[1]!),
      volume: word >= 0 ? word + 1 : Number(n),
    };
  }
  return { series: tidy(bare) || title.trim(), volume: null };
}

// Book Catalogue's "Discworld (4)", several joined with "|": the first one counts
export function seriesFromDetails(details: string) {
  const first = details.split("|")[0]!.trim();
  if (!first) return null;
  const m = first.match(/^(.*?)\s*\(([^()]*)\)\s*$/);
  if (!m) return { series: tidy(first), volume: null };
  const n = Number.parseFloat(m[2]!);
  return { series: tidy(m[1]!), volume: Number.isFinite(n) ? n : null };
}

const seriesKey = (name: string) =>
  name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();

// ---------- each app's columns ----------

const header = (headers: string[], ...patterns: RegExp[]) => {
  for (const pattern of patterns) {
    const i = headers.findIndex((h) => pattern.test(h.trim()));
    if (i >= 0) return i;
  }
  return -1;
};
// Goodreads writes ISBNs as ="0123", so a spreadsheet keeps the zeros
const cell = (row: string[], i: number) =>
  i < 0 ? "" : (row[i] ?? "").trim().replace(/^="?(.*?)"?$/, "$1");
const yes = (value: string) =>
  /^(1|y|yes|true|x|✓|read|finished|completed?)$/i.test(value);
const count = (value: string) => Number.parseFloat(value) || 0;
const stars = (value: string) => {
  const n = count(value);
  // some apps rate out of 10
  return Math.max(0, Math.min(5, n > 5 ? n / 2 : n));
};

export const isGoodreads = (headers: string[]) =>
  headers.includes("Exclusive Shelf") && headers.includes("Book Id");
export const isBookCatalogue = (headers: string[]) =>
  headers.includes("series_details") || headers.includes("book_uuid");

function goodreadsBook(h: string[], row: string[]): Book | null {
  const title = cell(row, header(h, /^Title$/));
  if (!title) return null;
  const shelf = cell(row, header(h, /^Exclusive Shelf$/)).toLowerCase();
  const shelves = cell(row, header(h, /^Bookshelves$/)).toLowerCase();
  const read =
    shelf === "read" || count(cell(row, header(h, /^Read Count$/))) > 0;
  const owned =
    count(cell(row, header(h, /^Owned Copies$/))) > 0 ||
    /(^|[\s,])(own|owned|owned-books|bought|purchased|my-collection|collection)([\s,]|$)/.test(
      shelves,
    );
  return {
    title,
    ...seriesFromTitle(title),
    owned,
    read,
    reading: shelf === "currently-reading",
    rating: stars(cell(row, header(h, /^My Rating$/))),
    planned: shelf === "to-read" && !owned && !read,
  };
}

function bookCatalogueBook(h: string[], row: string[]): Book | null {
  const title = cell(row, header(h, /^title$/));
  if (!title) return null;
  const shelf = cell(row, header(h, /^bookshelf$/));
  const read = yes(cell(row, header(h, /^read$/)));
  // it's a catalogue of the books they have, unless a shelf says otherwise
  const wanted = /wish|to.?buy|to.?read|want/i.test(shelf);
  const fromDetails = seriesFromDetails(
    cell(row, header(h, /^series_details$/)),
  );
  return {
    title,
    ...(fromDetails ?? seriesFromTitle(title)),
    owned: !wanted,
    read,
    reading: false,
    rating: stars(cell(row, header(h, /^rating$/))),
    planned: wanted && !read,
  };
}

// any other app: whichever columns look right. No owned column means it's a
// list of books they have
function csvBook(h: string[], row: string[]): Book | null {
  const title = cell(row, header(h, /^(title|book ?title|name)$/i, /title/i));
  if (!title) return null;
  const seriesColumn = cell(row, header(h, /^series( ?name)?$/i));
  const volumeColumn = Number.parseFloat(
    cell(
      row,
      header(h, /^(vol(ume)?|series ?(number|#|index|no\.?)|number|no\.?|#)$/i),
    ),
  );
  const fromTitle = seriesFromTitle(title);
  const ownedAt = header(h, /own|copies|purchased|bought/i);
  const owned =
    ownedAt < 0
      ? true
      : yes(cell(row, ownedAt)) || count(cell(row, ownedAt)) > 0;
  const readAt = header(
    h,
    /^(read|read status|status|exclusive shelf|shelf)$/i,
  );
  const read = readAt >= 0 && yes(cell(row, readAt));
  const reading =
    readAt >= 0 && /^(currently[- ]?)?reading$/i.test(cell(row, readAt));
  return {
    title,
    series: seriesColumn ? tidy(seriesColumn) : fromTitle.series,
    volume: Number.isFinite(volumeColumn) ? volumeColumn : fromTitle.volume,
    owned,
    read,
    reading,
    rating: stars(cell(row, header(h, /^(my )?(rating|score|stars)$/i))),
    planned: !owned && !read,
  };
}

export function readBooks(rows: string[][], source: BookSource): Book[] {
  const [headers = [], ...body] = rows;
  const h = headers.map((x) => x.trim());
  const toBook =
    source === "goodreads"
      ? goodreadsBook
      : source === "bookcatalogue"
        ? bookCatalogueBook
        : csvBook;
  return body.flatMap((row) => toBook(h, row) ?? []);
}

// ---------- grouping ----------

// one shelf entry per series. Volumes owned is the highest volume they bought,
// or the highest they've read if that's further on. Reading a volume now counts
// everything before it as read
export function groupBooks(books: Book[]): BookSeries[] {
  const groups = new Map<string, Book[]>();
  for (const book of books) {
    const key = seriesKey(book.series);
    if (key) groups.set(key, [...(groups.get(key) ?? []), book]);
  }
  return [...groups].map(([key, list]) => {
    const furthest = (picked: Book[]) => {
      const numbered = picked.flatMap((b) => (b.volume ? [b.volume] : []));
      return Math.floor(
        numbered.length ? Math.max(...numbered) : picked.length,
      );
    };
    const owned = furthest(list.filter((b) => b.owned));
    // on vol. 5 now means 1 to 4 are read, marked or not
    const readingFrom = list.flatMap((b) =>
      b.reading && b.volume ? [Math.floor(b.volume) - 1] : [],
    );
    const read = Math.max(furthest(list.filter((b) => b.read)), ...readingFrom);
    const rated = list.filter((b) => b.rating > 0);
    const average =
      rated.reduce((sum, b) => sum + b.rating, 0) / (rated.length || 1);
    return {
      key,
      title: list[0]!.series,
      books: list.length,
      ownedVolumes: Math.min(Math.max(owned, read), 999),
      readVolumes: Math.min(read, 999),
      score: Math.round(average * 2),
      planned: list.every((b) => b.planned),
    };
  });
}

export const toEntry = (
  s: BookSeries,
  match?: { malId: number | null; cover: string | null },
): MalEntry => ({
  ...(match?.malId ? { malId: match.malId } : {}),
  ...(match?.cover ? { cover: match.cover } : {}),
  title: s.title.slice(0, 300),
  finished: false,
  ...(s.planned ? { planned: true } : {}),
  chapters: 0,
  readVolumes: s.readVolumes,
  ownedVolumes: s.ownedVolumes,
  score: s.score,
});
