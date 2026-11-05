// Reading a book app's export (Goodreads, Book Catalogue, or any CSV) in the
// browser, so the file never leaves their computer. Book apps list every volume
// as its own book; the shelf has one entry per series, so volumes are grouped by
// series first. Kept free of the DOM so it can be tested on its own.
import { ownedVolumes } from "../ownedVolumes";
import type { MalEntry } from "./malImport";

export type BookSource = "goodreads" | "bookcatalogue" | "csv";

// one row of the export, whatever app it came from
export type Book = {
  title: string;
  series: string;
  // every name the series goes by, the series first: a Japanese edition's
  // "メイドインアビス 5 [Made in Abyss 5]" goes by both
  names: string[];
  volume: number | null;
  // only a number at the end of the title said so (readBooks checks it)
  guessed?: boolean;
  owned: boolean;
  read: boolean;
  // reading it now: everything before it counts as read
  reading: boolean;
  // 1-5, 0 for not rated
  rating: number;
  // on a want-to-read list and nothing else
  planned: boolean;
  // the title says so: "Overlord, Vol. 1 (light novel)"
  lightNovel: boolean;
};

export type BookSeries = {
  key: string;
  title: string;
  // its other names, for AniList when the title finds nothing
  otherNames: string[];
  books: number;
  ownedVolumes: number;
  // exactly which volumes they own (One Piece 1 and 4): every owned book's
  // number. [] owns none; null when an owned book has no number, so the
  // file can't say exactly. Missing on imports saved before it was kept
  ownedList?: number[] | null;
  readVolumes: number;
  score: number;
  // nothing owned or read yet: only on a to-read list
  planned: boolean;
  lightNovel: boolean;
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
  /[\s,:(\-–—]+(deluxe|omnibus|collector'?s|perfect|ultimate|master|complete|box ?set|vizbig|revised|full[\s-]colou?r(\s+collection)?|\d-in-\d|\d-in|\d+ ?in ?\d+)( edition)?\)?$/i;

const tidy = (name: string) =>
  name
    // the format is kept apart (titleSaysLightNovel), not in the name, and
    // "(Manga)" only says it isn't the novel
    .replace(/\s*\(\s*(light[\s-]?novels?|ln|novel|manga)\s*\)/gi, "")
    .replace(/\s+/g, " ")
    .replace(/[\s,:;.\-–—]+$/, "")
    // the format said in words: "Spice & Wolf: Manga", "Witch & Wizard: The Manga"
    .replace(
      /[\s,:\-–—]+(the )?(manga|manhwa|light[\s-]?novels?|graphic novels?)$/i,
      "",
    )
    // "English Version Attack on Titan"
    .replace(/^(english|japanese) (version|edition)\s+/i, "")
    // a "Vol" with its number lost: "Fairy Tail, Vol"
    .replace(/[,\s]+vol(ume)?\.?$/i, "")
    // library order: "Ghost in the Shell, The"
    .replace(/^(.+), (the|a|an)$/i, "$2 $1")
    .replace(EDITION, "")
    .replace(/[\s,:;.\-–—]+$/, "")
    // "Princess Jellyfish 2-in-1 Omnibus": one edition word, then another
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
// "Vol. II"
const ROMAN = [
  "i",
  "ii",
  "iii",
  "iv",
  "v",
  "vi",
  "vii",
  "viii",
  "ix",
  "x",
  "xi",
  "xii",
];
// in English, French (tome), Spanish and Italian (tomo) and German (Band)
// and French "Gachiakuta T03"
const VOLUME_WORD = String.raw`(?:vol(?:ume)?\.?|v\.|book|tome|tomo|band|bd\.|t(?=\d)|#)`;
const NUMBERED = new RegExp(
  String.raw`^(.*?)(?:[,:]|\s[-–—])?\s+${VOLUME_WORD}\s*(\d+(?:\.\d+)?|${NUMBER_WORDS.join("|")}|${ROMAN.join("|")})\b`,
  "i",
);
// Japanese editions: "メイドインアビス 第5巻", "ワンピース 9巻"
const JAPANESE_VOLUME = /^(.*?)\s*第?\s*(\d+(?:\.\d+)?)\s*巻/;
// a number at the end: "xxxHOLiC 19", "GACHIAKUTA 04". Up to three digits, so
// a year isn't read as one
// and "Gantz/3"
const TRAILING_NUMBER = /^(.*?\S)[\s,:#/\-–—]+0*(\d{1,3}(?:\.\d)?)$/;
// or before the volume's own title: "One Piece 31: Over Here"
const NUMBER_THEN_SUBTITLE = /^(.*?\D)\s+0*(\d{1,3}):\s+\S/;

const LATIN = /[a-z]/i;
// in square brackets but not a second name: "[Deluxe Edition]"
const NOT_A_NAME = new RegExp(
  [
    // editions and formats: "[Deluxe Edition]", "[Kindle]", "[Hardcover]"
    String.raw`^(deluxe|limited|special|collector'?s|omnibus|box ?set|hard ?cover|paper ?back|kindle|digital|e-?book|audio ?book|signed|first|1st|\d-in-\d)\b`,
    String.raw`\b(edition|version|translation|print(ing)?|format)$`,
    // languages: "[Japanese]", "[in Japanese]"
    String.raw`^(in )?(english|japanese|french|german|spanish|italian|korean|chinese|portuguese|polish|russian)( language)?$`,
    // what it is: "[Manga]", "[Light Novel]"
    String.raw`^(manga|manhwa|manhua|comics?|graphic novels?|light novels?|novels?)$`,
  ].join("|"),
  "i",
);

type Parsed = {
  series: string;
  volume: number | null;
  // every name the series goes by, the series first: both halves of
  // "メイドインアビス 5 [Made in Abyss 5]"
  names: string[];
  // only a number at the end said so: kept if another book backs it up
  // (confirmTrailingNumbers), so "Mob Psycho 100" on its own stays the name
  guessed?: boolean;
};

const numberOf = (text: string) => {
  const n = text.toLowerCase();
  const word = NUMBER_WORDS.indexOf(n);
  if (word >= 0) return word + 1;
  const roman = ROMAN.indexOf(n);
  if (roman >= 0) return roman + 1;
  return Number(n);
};

// one name with perhaps a volume in it, no brackets
function oneName(text: string, trailingNumber = true): Parsed {
  const numbered = text.match(NUMBERED);
  if (numbered && numbered[1]!.trim()) {
    const series = tidy(numbered[1]!);
    return { series, volume: numberOf(numbered[2]!), names: [series] };
  }
  const japanese = text.match(JAPANESE_VOLUME);
  if (japanese && japanese[1]!.trim()) {
    const series = tidy(japanese[1]!);
    return { series, volume: Number(japanese[2]), names: [series] };
  }
  const trailing =
    trailingNumber &&
    (tidy(text).match(TRAILING_NUMBER) ?? text.match(NUMBER_THEN_SUBTITLE));
  if (trailing && tidy(trailing[1]!)) {
    const series = tidy(trailing[1]!);
    return {
      series,
      volume: Number(trailing[2]),
      names: [series],
      guessed: true,
    };
  }
  const series = tidy(text) || text.trim();
  return { series, volume: null, names: [series] };
}

// "メイドインアビス 5 [Made in Abyss 5]" or "Ayashimon [アヤシモン]": either
// half can be the Japanese one. The half in Latin letters leads, as that's
// how the English volumes and AniList usually write it
function bracketed(text: string, trailingNumber = true): Parsed | null {
  // or "進撃の巨人 / Attack on Titan"
  const m =
    text.match(/^(.*?)\s*\[([^[\]]+)\]\s*(.*)$/) ??
    text.match(/^(.+?)\s+\/\s+(.+)()$/);
  if (!m || !m[1]!.trim() || NOT_A_NAME.test(m[2]!.trim())) return null;
  const halves = [
    oneName(`${m[1]} ${m[3]}`.trim(), trailingNumber),
    oneName(m[2]!, trailingNumber),
  ];
  const [first, second] = LATIN.test(halves[0]!.series)
    ? halves
    : [halves[1]!, halves[0]!];
  const numbered = halves.filter((h) => h.volume != null);
  // both halves with the same number is as good as "Vol."
  const agree =
    numbered.length === 2 && numbered[0]!.volume === numbered[1]!.volume;
  return {
    series: first!.series,
    volume: numbered[0]?.volume ?? null,
    names: [...new Set([first!.series, second!.series].filter(Boolean))],
    ...(numbered.length && !agree && numbered.every((h) => h.guessed)
      ? { guessed: true }
      : {}),
  };
}

const parseName = (text: string, trailingNumber = true): Parsed =>
  bracketed(text, trailingNumber) ?? oneName(text, trailingNumber);

// "One Piece, Vol. 1: Romance Dawn (One Piece, #1)" → One Piece, 1
// "Frieren: Beyond Journey's End, Vol. 3" → Frieren: Beyond Journey's End, 3
// "メイドインアビス 5 [Made in Abyss 5]" → Made in Abyss (and メイドインアビス), 5
export function seriesFromTitle(raw: string, trailingNumber = true): Parsed {
  // full-width digits and brackets, as Japanese titles often have, made plain
  const title = raw.normalize("NFKC");
  const tagged = title.match(/\(([^()]+?),?\s*#\s*(\d+(?:\.\d+)?)[^()]*\)\s*$/);
  if (tagged) {
    const named = parseName(tagged[1]!, trailingNumber);
    return { ...named, volume: Number(tagged[2]), guessed: undefined };
  }
  const bare = title
    .replace(/\s*\(\s*manga\s*\)/gi, "")
    .replace(/(\s*\([^()]*\))+\s*$/, "");
  return parseName(bare || title, trailingNumber);
}

// what some apps put in the series field that isn't a series: "Manga",
// "3-in-1 Edition", "Graphic Novels)", "Vol. 4-6 Hardcover"
const LABEL =
  /^(manga|manhwa|comics?|graphic novels?\)?|light novels?|novels?|omnibus|id_entity|.*\bedition\b.*|vol(ume)?s?\.?\s*[\d\s\-–&,]+.*)$/i;

// a name worth grouping by: has letters, isn't a label like "Manga", and isn't
// a scrap like "Dark Horse)" left by a publisher in brackets
const isName = (name: string) =>
  name.length > 1 &&
  /\p{L}/u.test(name) &&
  !LABEL.test(name) &&
  !NOT_A_NAME.test(name) &&
  // a title that's just "Volume 1" leaves "Volume", which names nothing
  !/^(vol(ume)?|v|book|tome|tomo|band|bd|part|chapter|issue|no|number|t)\.?$/i.test(
    name,
  ) &&
  !/^[^(]*\)/.test(name);

// Book Catalogue's "Discworld (4)", several joined with "|": the first one counts
export function seriesFromDetails(details: string): Parsed | null {
  const first = details.split("|")[0]!.normalize("NFKC").trim();
  if (!first || LABEL.test(first)) return null;
  const m = first.match(/^(.*?)\s*\(([^()]*)\)\s*$/);
  if (!m || !m[1]!.trim()) return seriesFromColumn(first);
  if (LABEL.test(m[1]!.trim())) return null;
  const n = Number.parseFloat(m[2]!);
  const named = seriesFromColumn(m[1]!);
  return named && { ...named, volume: Number.isFinite(n) && n > 0 ? n : null };
}

// a series column names the series, so a number in it is part of the name
function seriesFromColumn(text: string): Parsed | null {
  const clean = text.normalize("NFKC").trim();
  if (!clean || LABEL.test(clean)) return null;
  const named = bracketed(clean);
  const names = named?.names ?? [tidy(clean) || clean];
  return { series: names[0]!, volume: null, names };
}

// the series name compared: case, accents, spacing and punctuation don't count.
// Only Latin accents come off, so ネバーランド keeps its marks
const seriesKey = (name: string) =>
  name
    .toLowerCase()
    // "Hunter × Hunter"
    .replace(/×/g, "x")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .normalize("NFKC")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();

// publishers tag the novel editions, so the manga of the same name stays apart
const LIGHT_NOVEL = /\blight[\s-]?novels?\b|\(\s*(ln|novel)\s*\)/i;
export const titleSaysLightNovel = (...text: string[]) =>
  text.some((t) => LIGHT_NOVEL.test(t));

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
// its own columns: newer versions have series_details and book_uuid, and every
// version names its authors and shelves its own way. A plain "title" isn't
// enough: a spreadsheet read as Book Catalogue would count every book as owned
export const isBookCatalogue = (headers: string[]) =>
  headers.includes("series_details") ||
  headers.includes("book_uuid") ||
  (headers.includes("title") &&
    (headers.includes("author_details") || headers.includes("bookshelf_id")));

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

function bookCatalogueBook(h: string[], row: string[]): Book | null {
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

function bookshelfAppBook(h: string[], row: string[]): Book | null {
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

// "xxxHOLiC 19" is volume 19 when another book is xxxHOLiC too. On its own,
// "Mob Psycho 100" is the name, number and all
function confirmTrailingNumbers(books: Book[]): Book[] {
  // read without the rule: "Zom 100" names Zom 100, which "Zom 100 2" belongs to
  const whole = books.map((b) =>
    b.guessed ? seriesFromTitle(b.title, false) : null,
  );
  const seen = new Map<string, number>();
  books.forEach((book, i) => {
    const keys = new Set(
      [...book.names, ...(whole[i]?.names ?? [])].map(seriesKey),
    );
    for (const key of keys) seen.set(key, (seen.get(key) ?? 0) + 1);
  });
  return books.map(({ guessed, ...book }, i) => {
    const asWritten = whole[i];
    if (!guessed || !asWritten) return book;
    if (book.names.some((n) => (seen.get(seriesKey(n)) ?? 0) > 1)) return book;
    // the number stays in the name, and any other name it had goes with it
    const others = book.names.filter((n) => n !== book.series);
    return {
      ...book,
      series: asWritten.series,
      names: [...new Set([...asWritten.names, ...others])],
      volume: null,
    };
  });
}

// only real names are kept, as two books both "named" Manga would join two
// series. The book's own series stays if nothing else is left
const realNames = (book: Book): Book => {
  const names = book.names.filter(isName);
  if (!names.length) return { ...book, names: [book.series] };
  return {
    ...book,
    series: names.includes(book.series) ? book.series : names[0]!,
    names,
  };
};

export function readBooks(rows: string[][], source: BookSource): Book[] {
  const [headers = [], ...body] = rows;
  const h = headers.map((x) => x.trim());
  const toBook =
    source === "goodreads"
      ? goodreadsBook
      : source === "bookcatalogue"
        ? bookCatalogueBook
        : isBookshelfApp(h)
          ? bookshelfAppBook
          : csvBook;
  return confirmTrailingNumbers(
    body.flatMap((row) => toBook(h, row) ?? []).map(realNames),
  ).map(realNames);
}

// ---------- several files in one import ----------

// which app a file came from, by its columns
export type FileKind = "goodreads" | "bookcatalogue" | "bookshelf" | "csv";
export const fileKind = (headers: string[]): FileKind =>
  isGoodreads(headers)
    ? "goodreads"
    : isBookCatalogue(headers)
      ? "bookcatalogue"
      : isBookshelfApp(headers)
        ? "bookshelf"
        : "csv";

const KIND_NAME: Record<FileKind, string> = {
  goodreads: "a Goodreads export",
  bookcatalogue: "a Book Catalogue export",
  bookshelf: "a Bookshelf app export",
  csv: "a spreadsheet from another app",
};
const TAB_FOR: Record<FileKind, string> = {
  goodreads: "Goodreads",
  bookcatalogue: "Book Catalogue",
  bookshelf: "Other app",
  csv: "Other app",
};

// why this file can't go in an import from this tab, or null if it can. Each
// tab reads only its own app's files, as only that tab reads their shelves
// right. Other app takes the Bookshelf app or any spreadsheet, one kind per
// import; `importing` is the kind already in this import
export function wrongFile(
  name: string,
  source: BookSource,
  kind: FileKind,
  importing: FileKind | null,
): string | null {
  const wanted: FileKind | null =
    source === "goodreads"
      ? "goodreads"
      : source === "bookcatalogue"
        ? "bookcatalogue"
        : null;
  if (wanted && kind !== wanted) {
    return kind === "csv" || kind === "bookshelf"
      ? source === "goodreads"
        ? `${name} isn't a Goodreads export. Pick the file you downloaded from Goodreads' export page.`
        : `${name} isn't a Book Catalogue export. If it's from another app, choose Other app instead.`
      : `${name} is ${KIND_NAME[kind]}. Add it under ${TAB_FOR[kind]}.`;
  }
  if (!wanted && (kind === "goodreads" || kind === "bookcatalogue")) {
    return `${name} is ${KIND_NAME[kind]}. Add it under ${TAB_FOR[kind]}, which reads its shelves properly.`;
  }
  if (importing && kind !== importing) {
    return `${name} is ${KIND_NAME[kind]}, and this import is ${KIND_NAME[importing]}. Add it in an import of its own.`;
  }
  return null;
}

// a book that's in more than one file counts once: owned or read in either
// counts, it's only "to read" if every file says so, and the later file's
// rating wins when it has one. A file's own repeats are left as they are,
// unless the earlier file has that book too: then they're all that one book
const bookId = (b: Book) =>
  `${b.lightNovel ? "ln" : "m"}:${b.title.trim().toLowerCase()}`;
export function mergeBooks(earlier: Book[], later: Book[]): Book[] {
  const out = [...earlier];
  const at = new Map(earlier.map((b, i) => [bookId(b), i]));
  for (const b of later) {
    const i = at.get(bookId(b));
    if (i === undefined) {
      out.push(b);
      continue;
    }
    const a = out[i]!;
    out[i] = {
      ...a,
      owned: a.owned || b.owned,
      read: a.read || b.read,
      reading: a.reading || b.reading,
      planned: a.planned && b.planned,
      rating: b.rating || a.rating,
    };
  }
  return out;
}

// ---------- grouping ----------

// one shelf entry per series, and the light novel of a series is its own. A
// book joins every group that shares one of its names, so "Made in Abyss,
// Vol. 3" and "メイドインアビス 5 [Made in Abyss 5]" are one series. Volumes
// owned is the highest volume they bought, or the highest they've read if
// that's further on. Reading a volume now counts everything before it as read
export function groupBooks(books: Book[]): BookSeries[] {
  // union-find over the names' keys
  const parent = new Map<string, string>();
  const root = (key: string): string => {
    const up = parent.get(key) ?? key;
    if (up === key) return key;
    const top = root(up);
    parent.set(key, top);
    return top;
  };
  const keysOf = (book: Book) =>
    book.names.flatMap((name) => {
      const k = seriesKey(name);
      // as the server keys them (server/src/util/shelf/titleKey.ts shelfKey)
      return k ? [book.lightNovel ? `${k} (light novel)` : k] : [];
    });
  for (const book of books) {
    const [first, ...rest] = keysOf(book);
    if (!first) continue;
    if (!parent.has(first)) parent.set(first, first);
    for (const k of rest) {
      if (!parent.has(k)) parent.set(k, k);
      const a = root(first);
      const b = root(k);
      if (a !== b) parent.set(b, a);
    }
  }
  const groups = new Map<string, Book[]>();
  for (const book of books) {
    const [first] = keysOf(book);
    if (!first) continue;
    const top = root(first);
    groups.set(top, [...(groups.get(top) ?? []), book]);
  }
  return [...groups.values()].map((list) => {
    // the name most of its books use, one in Latin letters before any other
    const uses = new Map<string, { name: string; count: number }>();
    for (const b of list)
      for (const name of b.names) {
        const k = seriesKey(name);
        if (!k) continue;
        const was = uses.get(k);
        uses.set(k, { name: was?.name ?? name, count: (was?.count ?? 0) + 1 });
      }
    const ranked = [...uses.values()].sort(
      (a, b) =>
        Number(LATIN.test(b.name)) - Number(LATIN.test(a.name)) ||
        b.count - a.count,
    );
    const title = ranked[0]?.name ?? list[0]!.series;
    const lightNovel = list[0]!.lightNovel;
    const key = seriesKey(title);
    const furthest = (picked: Book[]) => {
      const numbered = picked.flatMap((b) => (b.volume ? [b.volume] : []));
      return Math.floor(
        numbered.length ? Math.max(...numbered) : picked.length,
      );
    };
    const owned = furthest(list.filter((b) => b.owned));
    const ownedBooks = list.filter((b) => b.owned);
    const ownedList = ownedBooks.every((b) => b.volume != null)
      ? [...new Set(ownedBooks.map((b) => b.volume!))].sort((a, b) => a - b)
      : null;
    // on vol. 5 now means 1 to 4 are read, marked or not
    const readingFrom = list.flatMap((b) =>
      b.reading && b.volume ? [Math.floor(b.volume) - 1] : [],
    );
    const read = Math.max(furthest(list.filter((b) => b.read)), ...readingFrom);
    const rated = list.filter((b) => b.rating > 0);
    const average =
      rated.reduce((sum, b) => sum + b.rating, 0) / (rated.length || 1);
    return {
      key: lightNovel ? `${key} (light novel)` : key,
      title,
      otherNames: ranked.slice(1).map((r) => r.name),
      books: list.length,
      ownedVolumes: Math.max(0, Math.min(Math.max(owned, read), 999)),
      ownedList,
      readVolumes: Math.max(0, Math.min(read, 999)),
      score: Math.round(average * 2),
      planned: list.every((b) => b.planned),
      lightNovel,
    };
  });
}

// other ways to search for a series AniList didn't find by its name:
// "Kon Kon Kokon 1" → "Kon Kon Kokon", "RWBY: The Official Manga: The Beacon
// Arc" → "RWBY", "Made in Abyss Official Anthology - Layer 2" → "Made in Abyss
// Official Anthology"
export function searchFallbacks(name: string): string[] {
  const out = [
    name.replace(/\s+#?\d{1,3}$/, ""),
    name.split(/\s*:\s+/)[0]!,
    name.split(/\s+(?:-{1,2}|[–—])\s+/)[0]!,
    // the creator's name in front: "Naoki Urasawa's Monster"
    name.replace(/^\p{Lu}[\p{L}.-]+\s+\p{Lu}[\p{L}.-]+['’]s\s+/u, ""),
  ].map((n) => n.trim());
  return [...new Set(out)].filter((n) => n !== name && /\p{L}{2}/u.test(n));
}

// rows AniList says are one series (its English and romaji names, "Hunter x
// Hunter" spelt two ways) come in as one: the furthest volumes of either
export function mergeSameSeries(
  found: BookSeries[],
  seriesId: (s: BookSeries) => number | null | undefined,
): BookSeries[] {
  const byId = new Map<string, BookSeries>();
  const out: BookSeries[] = [];
  for (const s of found) {
    const id = seriesId(s);
    const key = id ? `${id}:${s.lightNovel}` : null;
    const first = key ? byId.get(key) : undefined;
    if (!first) {
      const copy = { ...s };
      if (key) byId.set(key, copy);
      out.push(copy);
      continue;
    }
    first.books += s.books;
    first.ownedVolumes = Math.max(first.ownedVolumes, s.ownedVolumes);
    // both exact: together; either one not: no longer exact
    first.ownedList =
      first.ownedList && s.ownedList
        ? [...new Set([...first.ownedList, ...s.ownedList])].sort(
            (a, b) => a - b,
          )
        : null;
    first.readVolumes = Math.max(first.readVolumes, s.readVolumes);
    first.score = Math.max(first.score, s.score);
    first.planned = first.planned && s.planned;
    first.otherNames = [
      ...new Set([...first.otherNames, s.title, ...s.otherNames]),
    ];
  }
  return out;
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
  ...(s.lightNovel ? { lightNovel: true } : {}),
  chapters: 0,
  readVolumes: s.readVolumes,
  ownedVolumes: s.ownedVolumes,
  // only with gaps: a run from 1 is what ownedVolumes says already, and keeps
  // counting a volume read further on as theirs, as it always did
  ...(gapsIn(s.ownedList) ? { ownedList: s.ownedList! } : {}),
  score: s.score,
});

// owned volumes that aren't a run from 1
export const gapsIn = (list: number[] | null | undefined) =>
  Boolean(list?.length) && ownedVolumes(null, list).ownedList.length > 0;
