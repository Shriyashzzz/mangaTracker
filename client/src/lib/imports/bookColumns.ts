// Each app's export, read into books: which columns it has and what they
// mean (Goodreads, Book Catalogue, Bookshelf, Manga Tracker's own backup, or
// any CSV). Part of the book import (bookImport.ts lists the parts).
import { booksFromCell, newBook, type NewBook } from "../books";
import { parseVolumes } from "../ownedVolumes";
import { type Book } from "./bookTypes";
import {
  seriesFromTitle,
  seriesFromDetails,
  seriesFromColumn,
  titleSaysLightNovel,
} from "./bookNames";

// ---------- each app's columns ----------

export const header = (headers: string[], ...patterns: RegExp[]) => {
  for (const pattern of patterns) {
    const i = headers.findIndex((h) => pattern.test(h.trim()));
    if (i >= 0) return i;
  }
  return -1;
};
// Goodreads writes ISBNs as ="0123", so a spreadsheet keeps the zeros
export const cell = (row: string[], i: number) =>
  i < 0 ? "" : (row[i] ?? "").trim().replace(/^="?(.*?)"?$/, "$1");
const yes = (value: string) =>
  /^(1|y|yes|true|x|✓|read|finished|completed?)$/i.test(value);
export const count = (value: string) => Number.parseFloat(value) || 0;
const stars = (value: string) => {
  const n = count(value);
  // some apps rate out of 10
  return Math.max(0, Math.min(5, n > 5 ? n / 2 : n));
};

export const isGoodreads = (headers: string[]) =>
  headers.includes("Exclusive Shelf") && headers.includes("Book Id");
// its own columns: newer versions have series_details and book_uuid, and every
// version names its authors and shelves its own way. A plain "title" isn't
// enough: a spreadsheet read as Book Catalogue would count every book as owned
export const isBookCatalogue = (headers: string[]) =>
  headers.includes("series_details") ||
  headers.includes("book_uuid") ||
  (headers.includes("title") &&
    (headers.includes("author_details") || headers.includes("bookshelf_id")));

export function goodreadsBook(h: string[], row: string[]): Book | null {
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
    lightNovel: titleSaysLightNovel(title),
  };
}

// Book Catalogue keeps shelves as "read,in-jap," and a read flag that's often
// left unset, so the "read" shelf counts too
const shelvesOf = (value: string) =>
  value
    .toLowerCase()
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

export function bookCatalogueBook(h: string[], row: string[]): Book | null {
  const title = cell(row, header(h, /^title$/));
  if (!title) return null;
  const shelf = cell(row, header(h, /^bookshelf$/));
  const shelves = shelvesOf(shelf);
  const notOwned = shelves.some((s) => /don.?t.?own|not.?owned/.test(s));
  const read =
    yes(cell(row, header(h, /^read$/))) ||
    shelves.some(
      (s) => s === "read" || (/(^|-)read$/.test(s) && !/to.?read$/.test(s)),
    );
  // it's a catalogue of the books they have, unless a shelf says otherwise
  const wanted = /wish|to.?buy|to.?read|want/i.test(shelf);
  const details = cell(row, header(h, /^series_details$/));
  const fromTitle = seriesFromTitle(title);
  const fromDetails = seriesFromDetails(details);
  return {
    title,
    ...(fromDetails
      ? {
          ...fromDetails,
          names: [...new Set([...fromDetails.names, ...fromTitle.names])],
          volume: fromDetails.volume ?? fromTitle.volume,
          guessed: undefined,
        }
      : fromTitle),
    owned: !wanted && !notOwned,
    read,
    reading: false,
    rating: stars(cell(row, header(h, /^rating$/))),
    planned: wanted && !read,
    lightNovel: titleSaysLightNovel(title, details),
  };
}

// the Bookshelf app (bookshelf-app.com): a Bookshelf column with the shelf,
// Wishlist for what they want, and its own Series and Volume
export const isBookshelfApp = (headers: string[]) =>
  ["Book Id", "Bookshelf", "Wishlist", "Series", "Volume"].every((c) =>
    headers.includes(c),
  );

export function bookshelfAppBook(h: string[], row: string[]): Book | null {
  const title = cell(row, header(h, /^Title$/));
  if (!title) return null;
  const shelf = cell(row, header(h, /^Bookshelf$/)).toLowerCase();
  const wishlist = yes(cell(row, header(h, /^Wishlist$/)));
  const read = shelf === "read" || yes(cell(row, header(h, /^Read$/)));
  const reading = /^(currently[- ]?)?reading$/.test(shelf);
  const fromTitle = seriesFromTitle(title);
  const series = cell(row, header(h, /^Series$/));
  const fromColumn = seriesFromColumn(series);
  const volume = Number.parseFloat(cell(row, header(h, /^Volume$/)));
  const owned =
    !wishlist && count(cell(row, header(h, /^Number of copies$/))) > 0;
  return {
    title,
    ...(fromColumn
      ? {
          ...fromColumn,
          names: [...new Set([...fromColumn.names, ...fromTitle.names])],
          volume: fromTitle.volume,
          // the column names the series, so a number on the title is its volume
          guessed: undefined,
        }
      : fromTitle),
    ...(Number.isFinite(volume) && volume > 0
      ? { volume, guessed: undefined }
      : {}),
    owned,
    read,
    reading,
    rating: stars(cell(row, header(h, /^My Rating$/))),
    planned: !owned && !read && !reading,
    lightNovel: titleSaysLightNovel(
      title,
      series,
      cell(row, header(h, /^Format$/)),
    ),
  };
}

// Manga Tracker's own export (Settings, shelfToCsv): one row a series. Read
// back exactly, so an export is a backup: each owned volume becomes a book,
// with the series' status, chapter and notes. "Owned volumes" always lists
// them ("1–5, 8"); the older "Volumes owned" wrote a run from 1 as its number
export const isOwnExport = (headers: string[]) =>
  ["Title", "Type", "Status", "Chapter"].every((c) => headers.includes(c)) &&
  (headers.includes("Owned volumes") || headers.includes("Volumes owned"));

export function ownExportBooks(h: string[], row: string[]): Book[] {
  const title = tidyName(cell(row, header(h, /^Title$/)));
  if (!title) return [];
  const exact = header(h, /^Owned volumes$/);
  const text = cell(row, exact >= 0 ? exact : header(h, /^Volumes owned$/));
  const bare = /^\d{1,3}$/.test(text) && exact < 0;
  const volumes = bare
    ? Array.from({ length: Number(text) }, (_, i) => i + 1)
    : (parseVolumes(text) ?? []);
  const status = cell(row, header(h, /^Status$/)).toLowerCase();
  const chapter = Math.max(
    0,
    Math.floor(count(cell(row, header(h, /^Chapter$/)))),
  );
  const lightNovel = /novel/i.test(cell(row, header(h, /^Type$/)));
  const base = {
    series: title,
    names: [title],
    owned: true,
    read: false,
    reading: false,
    rating: stars(cell(row, header(h, /^Rating$/))),
    // on To read with volumes bought already: still To read
    planned: status === "to read",
    lightNovel,
    exact: true,
    genre: cell(row, header(h, /^Genre$/)).slice(0, 100) || undefined,
    finished: status === "finished",
    chapter,
    // backups from before these columns say neither
    readTo: Math.min(
      999,
      Math.max(0, Math.floor(count(cell(row, header(h, /^Read volume$/))))),
    ),
    ...(header(h, /^Tracked by$/) >= 0
      ? { byVolume: /volume/i.test(cell(row, header(h, /^Tracked by$/))) }
      : {}),
    notes: cell(row, header(h, /^Notes$/)).slice(0, 450) || undefined,
  };
  const ownBooks = booksFromCell(cell(row, header(h, /^Books$/)));
  const collecting = cell(row, header(h, /^Collecting$/)).toLowerCase();
  if (/^[a-z0-9]{1,20}$/.test(collecting)) Object.assign(base, { collecting });
  if (!volumes.length)
    return [
      {
        ...base,
        title,
        volume: null,
        owned: false,
      },
    ];
  return volumes.map((v, i) => ({
    ...base,
    title: `${title} #${v}`,
    volume: v,
    ...(i === 0 && ownBooks.length ? { ownBooks } : {}),
  }));
}

// a series' books as the import sends them: a backup's own record, or else
// every owned book that says its volumes, whatever edition it is. A file with
// no ISBNs and only singles has nothing a tick doesn't say, so sends none
export const bookListOf = (
  owned: Book[],
  volumesOf: (b: Book) => number[],
): { bookList?: NewBook[] } => {
  const own = owned.flatMap((b) => b.ownBooks ?? []);
  if (own.length) return { bookList: own };
  const list = owned
    .filter((b) => !b.omnibus && volumesOf(b).length)
    .map((b) => newBook(b.title, volumesOf(b), b.isbn));
  return list.some((b) => b.isbn13 || b.edition !== "single")
    ? { bookList: list }
    : {};
};
const tidyName = (name: string) => name.replace(/\s+/g, " ").trim();

// any other app: whichever columns look right. No owned column means it's a
// list of books they have
export function csvBook(h: string[], row: string[]): Book | null {
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
  const fromColumn = seriesFromColumn(seriesColumn);
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
    ...(fromColumn
      ? {
          ...fromColumn,
          names: [...new Set([...fromColumn.names, ...fromTitle.names])],
          volume: fromTitle.volume,
          // the column names the series, so a number on the title is its volume
          guessed: undefined,
        }
      : fromTitle),
    ...(Number.isFinite(volumeColumn)
      ? { volume: volumeColumn, guessed: undefined }
      : {}),
    owned,
    read,
    reading,
    rating: stars(cell(row, header(h, /^(my )?(rating|score|stars)$/i))),
    planned: !owned && !read,
    lightNovel: titleSaysLightNovel(
      title,
      seriesColumn,
      cell(row, header(h, /^(type|format|kind)$/i)),
    ),
  };
}

// rows with an ISBN and no title (a scanner app's list): the ISBNs, to be
// looked up as a barcode is (bookFromScan). Any app's file
export function isbnOnlyRows(rows: string[][]): string[] {
  const [headers = [], ...body] = rows;
  const h = headers.map((x) => x.trim());
  const titleAt = header(h, /^(title|book ?title|name)$/i, /title/i);
  const isbnAt = header(h, /^isbn ?(13)?$/i, /isbn/i);
  if (isbnAt < 0) return [];
  return [
    ...new Set(
      body.flatMap((row) => {
        if (titleAt >= 0 && cell(row, titleAt)) return [];
        const isbn = cell(row, isbnAt).replace(/[^0-9Xx]/g, "");
        return /^(97[89]\d{10}|\d{9}[\dXx])$/.test(isbn) ? [isbn] : [];
      }),
    ),
  ];
}

// a looked-up ISBN as a book of the file: owned, with every volume it holds
export const bookFromScan = (scan: {
  isbn13?: string;
  shelfName: string;
  volume: number;
  volumes: number[];
  lightNovel: boolean;
}): Book => ({
  title: `${scan.shelfName} #${scan.volume}`,
  series: scan.shelfName,
  names: [scan.shelfName],
  volume: scan.volume,
  ...(scan.volumes.length > 1 ? { holds: scan.volumes } : {}),
  owned: true,
  read: false,
  reading: false,
  rating: 0,
  planned: false,
  lightNovel: scan.lightNovel,
  ...(scan.isbn13 ? { isbn: scan.isbn13 } : {}),
});
