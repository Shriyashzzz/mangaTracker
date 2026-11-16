// Each app's export, read into books: which columns it has and what they
// mean (Goodreads, Book Catalogue, Bookshelf, Manga Tracker's own backup, or
// any CSV). Part of the book import (bookImport.ts lists the parts).
import { importDate } from "./importDate";
import { booksFromCell, centsOf, newBook, type NewBook } from "../books";
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
    // the day they read it, or else the day they added it
    changedOn:
      importDate(cell(row, header(h, /^Date Read$/))) ??
      importDate(cell(row, header(h, /^Date Added$/))),
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
    // the day they finished it, or else the day they added it. Not its
    // "last_update_date": one sync stamps nearly every book with the same day
    changedOn:
      importDate(cell(row, header(h, /^read_end$/))) ??
      importDate(cell(row, header(h, /^date_added$/))),
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
    // the day they finished it, or else the day they added it
    changedOn:
      importDate(cell(row, header(h, /^Ended Reading On$/))) ??
      importDate(cell(row, header(h, /^Date added$/i))),
  };
}

// Manga Tracker's own export (Settings, shelfToCsv): one row a series. Read
// back exactly, so an export is a backup: each owned volume becomes a book,
// with the series' status, chapter and notes. "Owned volumes" always lists
// them ("1–5, 8"); the older "Volumes owned" wrote a run from 1 as its number
export const isOwnExport = (headers: string[]) =>
  ["Title", "Type", "Status", "Chapter"].every((c) => headers.includes(c)) &&
  (headers.includes("Owned volumes") || headers.includes("Volumes owned"));

// a cell of our own backup. The export puts an apostrophe before a cell a
// spreadsheet would read as a formula ("+Anima", a note starting with a
// dash, a book with no ISBN); it comes off here, so the cell is as it was
// (lib/shelfCsv.ts csvCell)
const ownCell = (row: string[], i: number) => {
  if (i < 0) return "";
  const text = (row[i] ?? "").trim();
  return /^'+[=+\-@\t\r]/.test(text) ? text.slice(1) : text;
};

export function ownExportBooks(h: string[], row: string[]): Book[] {
  const title = tidyName(ownCell(row, header(h, /^Title$/)));
  if (!title) return [];
  const exact = header(h, /^Owned volumes$/);
  const text = ownCell(row, exact >= 0 ? exact : header(h, /^Volumes owned$/));
  const bare = /^\d{1,3}$/.test(text) && exact < 0;
  const volumes = bare
    ? Array.from({ length: Number(text) }, (_, i) => i + 1)
    : (parseVolumes(text) ?? []);
  const status = ownCell(row, header(h, /^Status$/)).toLowerCase();
  const chapter = Math.max(
    0,
    Math.floor(count(ownCell(row, header(h, /^Chapter$/)))),
  );
  const lightNovel = /novel/i.test(ownCell(row, header(h, /^Type$/)));
  const base = {
    series: title,
    names: [title],
    owned: true,
    read: false,
    reading: false,
    rating: stars(ownCell(row, header(h, /^Rating$/))),
    // on To read with volumes bought already: still To read
    planned: status === "to read",
    lightNovel,
    exact: true,
    genre: ownCell(row, header(h, /^Genre$/)).slice(0, 100) || undefined,
    finished: status === "finished",
    chapter,
    // backups from before these columns say neither
    readTo: Math.min(
      999,
      Math.max(0, Math.floor(count(ownCell(row, header(h, /^Read volume$/))))),
    ),
    ...(header(h, /^Tracked by$/) >= 0
      ? { byVolume: /volume/i.test(ownCell(row, header(h, /^Tracked by$/))) }
      : {}),
    notes: ownCell(row, header(h, /^Notes$/)).slice(0, 450) || undefined,
    // backups from before this column have none
    changedOn: importDate(ownCell(row, header(h, /^Updated$/))),
  };
  const ownBooks = booksFromCell(ownCell(row, header(h, /^Books$/)));
  const collecting = ownCell(row, header(h, /^Collecting$/)).toLowerCase();
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
    .map((b) => ({
      ...newBook(b.title, volumesOf(b), b.isbn),
      ...(b.paidCents != null ? { paidCents: b.paidCents } : {}),
      ...(b.boughtOn ? { boughtOn: b.boughtOn } : {}),
    }));
  // sent when a book says more than a tick would: its ISBN, its edition,
  // what was paid, or when
  return list.some(
    (b) =>
      b.isbn13 || b.edition !== "single" || b.paidCents != null || b.boughtOn,
  )
    ? { bookList: list }
    : {};
};
const tidyName = (name: string) => name.replace(/\s+/g, " ").trim();

// the column holding each row's name: a title, or on a list of series, the
// series ("Series", "Manga") when there's no title column
const TITLE_COLUMN = [
  /^(title|book ?title|name)$/i,
  /title/i,
  /^(series( ?name)?|manga|manga title)$/i,
];

const NOT_OWNED = /^(0|no|n|false|not owned|don'?t own|wishlist|wanted)$/i;

// any other app: whichever columns look right. No owned column means it's a
// list of books they have
export function csvBook(h: string[], row: string[]): Book | null {
  const title = cell(row, header(h, ...TITLE_COLUMN));
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
  // whether they own it: never a column about when or for how much ("Date
  // Purchased", "Price Paid"), whose "2025-11-02" isn't a count
  const ownedAt = header(
    h,
    /^(?!.*\b(date|day|price|paid|cost)\b).*(own|copies|purchased|bought)|^qty$|quantity/i,
  );
  const owned =
    ownedAt < 0
      ? true
      : yes(cell(row, ownedAt)) || count(cell(row, ownedAt)) > 0;
  // said in so many words: not theirs (a blank cell says nothing)
  const notOwned =
    ownedAt >= 0 && NOT_OWNED.test(cell(row, ownedAt)) ? true : undefined;
  const readAt = header(
    h,
    /^(read|read status|status|exclusive shelf|shelf)$/i,
  );
  const read = readAt >= 0 && yes(cell(row, readAt));
  const reading =
    readAt >= 0 && /^(currently[- ]?)?reading$/i.test(cell(row, readAt));
  // only a column that says it's what they paid: a plain "Price" may be the
  // cover price
  const paid = centsOf(
    cell(row, header(h, /^(price ?paid|paid|purchase ?price|amount paid)$/i)),
  );
  // the day they bought it: a column that says so ("Date Purchased")
  const bought = importDate(
    cell(
      row,
      header(
        h,
        /^(date ?(purchased|bought|of purchase)|purchased?( ?date| on)?|bought( ?on| ?date)?)$/i,
      ),
    ),
  )?.slice(0, 10);
  return {
    ...(paid != null ? { paidCents: paid } : {}),
    ...(bought ? { boughtOn: bought } : {}),
    ...(readAt < 0 ? { noReadStatus: true } : {}),
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
    ...(notOwned ? { notOwned } : {}),
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

// A row that stands for a whole series: "One Piece" with "1-107", or
// "1-5, 7-12", in its volumes column, read as one book per volume it holds,
// and a Status of Finished marks the series finished.
// A column named for several volumes ("Owned volumes", "Volumes owned",
// "Volumes", or "Owned" with a number in it) may also give a plain count: "12" is vols. 1 to 12.
// Anything else is the row's one book, as csvBook reads it
const TO_READ = /^(to[- ]read|plan(ned)? to read|want to read|wishlist)$/i;
const BOX_SET_WORDS = /\bbox(ed)?\s?set\b|\ball-in-one\b/i;
const VOLUMES_COLUMN = /^((owned|my) )?vol(ume)?s( owned)?$/i;
// a column called just "Owned" is yes or no on most files; a number in it
// ("12", "1-12") is how many they own
const OWNED_COLUMN = /^owned$/i;
const VOLUME_COLUMN = /^(vol(ume)?|number|no\.?|#)$/i;

// What a volumes cell says, in the ways people write it: "1-107", "1-5,
// 7-12", "v1-v37", "1~74", "1 to 12", "12 vols". `several`: the column is
// for a series' volumes, so a plain number is a count and 0 or blank is none
type VolumesCell =
  | { kind: "volumes"; volumes: number[] }
  | { kind: "none" }
  | { kind: "one"; volume: number | null }
  | { kind: "unreadable" };
export function readVolumesCell(text: string, several: boolean): VolumesCell {
  const plain = text
    .trim()
    // "v12", "vol. 12", "#12": the number
    .replace(/(?:\bvol(?:ume)?s?\.?|\bv|#)\s*(?=\d)/gi, "")
    // "1~74", "1 to 74": a range
    .replace(/\s*(?:~|\bto\b|\bthru\b|\bthrough\b)\s*/gi, "-")
    // "12 vols", "12 books": the count
    .replace(/\s*\b(?:vols?\.?|volumes?|books?)$/i, "")
    // "1-5 & 7", "1-5 and 7": a list
    .replace(/\s*(?:&|\band\b)\s*/gi, ", ")
    .trim();
  if (!plain) return several ? { kind: "none" } : { kind: "one", volume: null };
  if (/^\d{1,3}$/.test(plain)) {
    const n = Number(plain);
    if (!several) return { kind: "one", volume: n };
    if (n === 0) return { kind: "none" };
    return {
      kind: "volumes",
      volumes: Array.from({ length: n }, (_, i) => i + 1),
    };
  }
  const volumes = /[-–,]/.test(plain) ? parseVolumes(plain) : null;
  return volumes?.length
    ? { kind: "volumes", volumes }
    : { kind: "unreadable" };
}

export function csvBooks(h: string[], row: string[]): Book[] {
  const book = csvBook(h, row);
  if (!book) return [];
  const ownedAt = header(h, OWNED_COLUMN);
  const volumesAt = header(h, VOLUMES_COLUMN);
  let severalAt = volumesAt;
  if (severalAt < 0 && /\d/.test(cell(row, ownedAt))) severalAt = ownedAt;
  const several = severalAt >= 0;
  const said = readVolumesCell(
    cell(row, several ? severalAt : header(h, VOLUME_COLUMN)),
    several,
  );
  if (said.kind === "one")
    return [
      book.volume == null && said.volume != null
        ? { ...book, volume: said.volume, guessed: undefined }
        : book,
    ];
  // the title names the whole series, so a number at its end is part of the
  // name ("Kaiju No. 8", "Mob Psycho 100"), not a volume. A Series column,
  // when there is one, has named it already
  const hasSeriesColumn = Boolean(cell(row, header(h, /^series( ?name)?$/i)));
  const named = hasSeriesColumn ? {} : seriesFromTitle(book.title, false);
  // a row for a whole series that says Finished: the series is finished,
  // not only these books read. "Reading" is about the series too: it isn't
  // "read up to the last volume owned"
  const status = cell(row, header(h, /^(status|read status|state)$/i));
  const finished = /^(finished|completed?|done)$/i.test(status);
  const series = {
    ...book,
    ...named,
    ...(finished ? { finished: true } : {}),
    reading: false,
    // they have it, or have said how many they have: not a to-read entry
    planned: false,
    guessed: undefined,
    // a price or a day on a row for several volumes is the row's, not each
    // book's
    paidCents: undefined,
    boughtOn: undefined,
  };
  // none owned ("0", or left blank): the series, with nothing owned. With no
  // status saying otherwise it's one they mean to read
  if (said.kind === "none")
    return [
      {
        ...series,
        volume: null,
        owned: false,
        planned: !status || TO_READ.test(status),
      },
    ];
  // something we can't read: asked about in the preview, never "vol. 1"
  if (said.kind === "unreadable")
    return [{ ...series, volume: null, owned: true, omnibus: true }];
  // each book keeps the row's title, edition words and all ("Berserk
  // Deluxe Edition #3"), so a deluxe or omnibus run is still read as one.
  // A box set's row lists the volumes inside it ("Akira 35th Anniversary Box
  // Set", 1-6): those are the series' own volumes
  const base = BOX_SET_WORDS.test(book.title)
    ? hasSeriesColumn
      ? book.series
      : seriesFromTitle(book.title, false).series
    : book.title;
  return said.volumes.map((volume) => ({
    ...series,
    owned: true,
    title: `${base} #${volume}`,
    volume,
  }));
}

// rows with an ISBN and no title (a scanner app's list): the ISBNs, to be
// looked up as a barcode is (bookFromScan). Any app's file
export function isbnOnlyRows(rows: string[][]): string[] {
  const [headers = [], ...body] = rows;
  const h = headers.map((x) => x.trim());
  const titleAt = header(h, ...TITLE_COLUMN);
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
