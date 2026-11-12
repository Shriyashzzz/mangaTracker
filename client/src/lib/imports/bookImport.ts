// Reading a book app's export (Goodreads, Book Catalogue, or any CSV) in the
// browser, so the file never leaves their computer. Book apps list every volume
// as its own book; the shelf has one entry per series, so volumes are grouped by
// series first. Kept free of the DOM so it can be tested on its own.
import { ownedVolumes, parseVolumes } from "../ownedVolumes";
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
  // every volume the book holds, when it's more than one: "Bleach (3-in-1
  // Edition), Vol. 21" is 61, 62 and 63 (volumesInside)
  holds?: number[];
  // an omnibus that doesn't say which volumes it holds ("Vinland Saga
  // Omnibus, Vol. 3"): its number is the omnibus', not a volume's
  omnibus?: boolean;
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
  // only Manga Tracker's own export says these (ownExportBooks)
  finished?: boolean;
  chapter?: number;
  notes?: string;
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
  // some of its books are omnibuses that don't say which volumes they hold,
  // so the count is worth a look before adding
  omnibus?: boolean;
  // a row that is several series AniList says are one (mergeSameSeries):
  // every one's key, its own first
  members?: string[];
  // from Manga Tracker's own export: finished, the chapter they're on, notes
  finished?: boolean;
  chapters?: number;
  notes?: string;
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

// a special edition is still the same series: "Berserk Deluxe Edition" is Berserk.
// Words that end real names ("Rave Master") count only before "Edition"
const EDITION =
  /[\s,:(\-–—]+(the )?((deluxe|omnibus|complete( collection)?|box ?set|vizbig|full[\s-]colou?r(\s+collection)?|\d-in-\d|\d-in|\d+ ?in ?\d+)( edition)?|(collector'?s|perfect|ultimate|master|revised) edition)\)?$/i;

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
    // an edition's own number: "Siúil, a Rún Deluxe Edition II"
    .replace(
      /[\s,:(\-–—]+(deluxe|omnibus|collector'?s|perfect|ultimate|master) edition\s+[ivx]+$/i,
      "",
    )
    .replace(/[\s,:;.\-–—]+$/, "")
    .trim();

// two spaces between words are where an export dropped an "&": "Wolf  Parchment:
// New Theory Spice  Wolf" is Wolf & Parchment
const withAmpersands = (text: string) =>
  // not before a volume word: "…Cheat Powers  Vol. 8" is just a typo
  text.replace(
    /(\p{L}) {2}(?!(?:vol(?:ume)?s?|book|part|tome|tomo|band|no)\b)(?=\p{L})/giu,
    "$1 & ",
  );

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

// "Crying Freeman, No. 1: Shades of Death". Only after a comma, so "No. 6"
// and "Kaiju No. 8" stay names
const COMMA_NUMBER = /^(.*?),\s+no\.\s*(\d{1,3})\b/i;

// a number right after Chinese or Japanese text: "One Piece 航海王37: 湯姆先生"
// is One Piece 航海王, vol. 37
const CJK_NUMBER =
  /^(.*[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}])\s*0*(\d{1,3})(?=$|[\s:：(（])/u;

// one name with perhaps a volume in it, no brackets
function oneName(text: string, trailingNumber = true): Parsed {
  const comma = text.match(COMMA_NUMBER);
  if (comma && tidy(comma[1]!)) {
    const series = tidy(comma[1]!);
    return { series, volume: Number(comma[2]), names: [series] };
  }
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
  // only a guess too, as the number can be the name's: "モブサイコ100"
  const cjk = trailingNumber && text.match(CJK_NUMBER);
  if (cjk && tidy(cjk[1]!)) {
    const series = tidy(cjk[1]!);
    return { series, volume: Number(cjk[2]), names: [series], guessed: true };
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
function seriesFromTitle(raw: string, trailingNumber = true): Parsed {
  // full-width digits and brackets, as Japanese titles often have, made plain
  const asWritten = raw.normalize("NFKC");
  // some apps drop "&" and leave its two spaces: "Wolf  Parchment". It could
  // also be a typo ("One  Piece"), so the name as written stays one of its
  // names, searched if the "&" one finds nothing
  const restored = withAmpersands(asWritten);
  const parsed = parseTitle(restored, trailingNumber);
  if (restored === asWritten) return parsed;
  const plain = parseTitle(asWritten, trailingNumber);
  return { ...parsed, names: [...new Set([...parsed.names, ...plain.names])] };
}

function parseTitle(title: string, trailingNumber: boolean): Parsed {
  const tagged = title.match(/\(([^()]+?),?\s*#\s*(\d+(?:\.\d+)?)[^()]*\)\s*$/);
  if (tagged) {
    // the tag names the series, so a number in it is the name's: "(Mob
    // Psycho 100, #4)", "(Eyeshield 21, #2)"
    const named = parseName(tagged[1]!, false);
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
function seriesFromDetails(details: string): Parsed | null {
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

// a light novel's names are its own: a manga never joins one
const formatOf = (b: { lightNovel: boolean }) => (b.lightNovel ? "ln" : "m");

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

const isGoodreads = (headers: string[]) =>
  headers.includes("Exclusive Shelf") && headers.includes("Book Id");
// its own columns: newer versions have series_details and book_uuid, and every
// version names its authors and shelves its own way. A plain "title" isn't
// enough: a spreadsheet read as Book Catalogue would count every book as owned
const isBookCatalogue = (headers: string[]) =>
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
const isBookshelfApp = (headers: string[]) =>
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

// Manga Tracker's own export (Settings, shelfToCsv): one row a series. Read
// back exactly, so an export is a backup: each owned volume becomes a book,
// with the series' status, chapter and notes. "Owned volumes" always lists
// them ("1–5, 8"); the older "Volumes owned" wrote a run from 1 as its number
export const isOwnExport = (headers: string[]) =>
  ["Title", "Type", "Status", "Chapter"].every((c) => headers.includes(c)) &&
  (headers.includes("Owned volumes") || headers.includes("Volumes owned"));

function ownExportBooks(h: string[], row: string[]): Book[] {
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
    planned: false,
    lightNovel,
    finished: status === "finished",
    chapter,
    notes: cell(row, header(h, /^Notes$/)).slice(0, 450) || undefined,
  };
  if (!volumes.length)
    return [
      {
        ...base,
        title,
        volume: null,
        owned: false,
        planned: status === "to read",
      },
    ];
  return volumes.map((v) => ({ ...base, title: `${title} #${v}`, volume: v }));
}
const tidyName = (name: string) => name.replace(/\s+/g, " ").trim();

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
});

// ---------- books that hold several volumes ----------

const RUN_MAX = 10;
const run = (from: number, to: number) =>
  to > from && to - from < RUN_MAX
    ? Array.from({ length: to - from + 1 }, (_, i) => from + i)
    : null;
// a list read off the title, if it counts up and is a few volumes long
const listed = (text: string) => {
  const ns = [...text.matchAll(/\d{1,3}/g)].map((m) => Number(m[0]));
  return ns.length >= 2 &&
    ns.every((n, i) => i === 0 || n > ns[i - 1]!) &&
    ns[ns.length - 1]! - ns[0]! < RUN_MAX
    ? ns
    : null;
};
// "Includes vols. 61, 62 & 63", "Includes Vol. 1 & 2", "Volumes 1, 2, and 3",
// and with the "&" dropped: "Includes vols. 43, 44  45"
const SAYS_WHICH =
  /(?:includes\s+vol(?:ume)?s?\.?|\bvol(?:ume)?s\.?)\s*(\d{1,3}(?:\s*(?:,|&|and)?\s*(?:and\s+)?\d{1,3})+)/i;
// "(Negima! Magister Negi Magi, #1-3)"
const TAG_RANGE = /#\s*(\d{1,3})\s*[-–]\s*(\d{1,3})\b/;
// "One Piece: East Blue 1-2-3"
const HYPHEN_LIST = /\b(\d{1,3})-(\d{1,3})-(\d{1,3})\b/;
// "Cardcaptor Sakura, Volume 4-6", "Kanokon Omnibus 1-2", "(Vol. 1-3 Hardcover)"
const RANGE =
  /\b(?:vol(?:ume)?s?\.?|omnibus|books?)\s*(\d{1,3})\s*(?:[-–]|to)\s*(\d{1,3})\b/i;
// "Bleach (3-in-1 Edition), Vol. 21" is 61 to 63
const N_IN_ONE = /\b([234])\s*-?\s*in\s*-?\s*1\b/i;
// a box set that doesn't say which volumes it holds is one too: "Demon
// Slayer Complete Box Set" is far more than vol. 1, so the import asks which
// instead of guessing. (A deluxe edition stays its own number, as before)
const OMNIBUS =
  /\bomnibus\b|\bcomplete collection\b|\bbind-?up\b|\bbox ?set\b/i;

// which volumes a book holds, from the surest the title says to the least:
// listed, a range, or N-in-1 with the omnibus' number. An omnibus that says
// none of these only has the omnibus' own number, which isn't a volume
export function volumesInside(
  title: string,
  volume: number | null,
): { holds?: number[]; omnibus?: true; before?: string } {
  const text = withAmpersands(title.normalize("NFKC"));
  // and what came before it, which may be all the series' name is:
  // "Kanokon Omnibus 1-2" is Kanokon
  const found = (m: RegExpMatchArray, holds: number[]) => ({
    holds,
    before: text.slice(0, m.index),
  });
  const says = text.match(SAYS_WHICH);
  const fromList = says && listed(says[1]!);
  if (fromList) return found(says, fromList);
  const tag = text.match(TAG_RANGE);
  const fromTag = tag && run(Number(tag[1]), Number(tag[2]));
  if (fromTag) return { holds: fromTag };
  const hyphens = text.match(HYPHEN_LIST);
  const fromHyphens = hyphens && listed(hyphens.slice(1).join(" "));
  if (fromHyphens) return { holds: fromHyphens };
  const range = text.match(RANGE);
  const fromRange = range && run(Number(range[1]), Number(range[2]));
  if (fromRange) return found(range, fromRange);
  // Viz's VIZBIG editions are 3-in-1s too
  const perBook =
    text.match(N_IN_ONE)?.[1] ?? (/\bvizbig\b/i.test(text) ? "3" : null);
  if (perBook && volume && Number.isInteger(volume)) {
    const n = Number(perBook);
    return { holds: run((volume - 1) * n + 1, volume * n)! };
  }
  return OMNIBUS.test(text) ? { omnibus: true } : {};
}

// the series' name cut where the volumes start, when the name ran into them
// ("Kanokon Omnibus 1-2" is Kanokon)
const cutTo = (book: Book, before: string): Partial<Book> => {
  const name = tidy(withAmpersands(before));
  return name &&
    name.length < book.series.length &&
    seriesKey(book.series).startsWith(seriesKey(name))
    ? {
        series: name,
        names: [name, ...book.names.filter((n) => n !== book.series)],
      }
    : {};
};

// editions whose books each hold a fixed number of the series' volumes, with
// nothing in the title saying which: "Berserk Deluxe Edition, Vol. 2" is 4 to
// 6. Any other deluxe, perfect or collector's edition is asked about, like an
// omnibus, as its number isn't a volume's
const EDITIONS: {
  series: RegExp;
  edition: RegExp;
  perBook: number;
  books: number;
  volumes: number;
}[] = [
  {
    series: /^berserk$/,
    edition: /\bdeluxe\b/i,
    perBook: 3,
    books: 14,
    volumes: 42,
  },
  {
    series: /^vinland saga$/,
    edition: /\bbook\b|\bhardcover\b/i,
    perBook: 2,
    books: 7,
    volumes: 14,
  },
  {
    series: /^monster$/,
    edition: /\bperfect edition\b/i,
    perBook: 2,
    books: 9,
    volumes: 18,
  },
  {
    series: /^fruits basket$/,
    edition: /\bcollector'?s edition\b/i,
    perBook: 2,
    books: 12,
    volumes: 23,
  },
];
const SPECIAL_EDITION =
  /\b(deluxe|perfect edition|collector'?s edition|fullmetal edition|master edition)\b/i;

export function editionVolumes(
  series: string,
  title: string,
  volume: number | null,
): { holds: number[] } | { omnibus: true } | null {
  const key = seriesKey(series);
  const known = EDITIONS.find(
    (e) => e.series.test(key) && e.edition.test(title),
  );
  if (known && volume && Number.isInteger(volume) && volume <= known.books) {
    const from = (volume - 1) * known.perBook + 1;
    const to = Math.min(volume * known.perBook, known.volumes);
    return {
      holds: Array.from({ length: to - from + 1 }, (_, i) => from + i),
    };
  }
  return SPECIAL_EDITION.test(title) ? { omnibus: true } : null;
}

const withVolumesInside = (book: Book): Book => {
  const edition = editionVolumes(book.series, book.title, book.volume);
  if (edition && "holds" in edition)
    return {
      ...book,
      volume: edition.holds[0]!,
      holds: edition.holds,
      guessed: undefined,
    };
  if (edition)
    return { ...book, volume: null, omnibus: true, guessed: undefined };
  // a number only guessed from the end of the title ("Mob Psycho 100 3-in-1")
  // may be the name's, so it isn't taken as an omnibus' number. Right after
  // "Omnibus" it is the omnibus': "Negima! Omnibus 9"
  const guessed =
    book.guessed && !/\bomnibus,?\s*(?:vol(?:ume)?\.?\s*)?\d/i.test(book.title);
  const { holds, omnibus, before } = volumesInside(
    book.title,
    guessed ? null : book.volume,
  );
  if (holds) {
    return {
      ...book,
      ...(before !== undefined ? cutTo(book, before) : {}),
      volume: holds[0]!,
      holds,
      guessed: undefined,
    };
  }
  if (omnibus && !guessed) {
    // "Negima! Omnibus 9: Magister Negi Magi" is Negima!
    const at = book.title.search(/\bomnibus\b/i);
    return {
      ...book,
      ...(at > 0 ? cutTo(book, book.title.slice(0, at)) : {}),
      volume: null,
      omnibus,
      guessed: undefined,
    };
  }
  if (omnibus) return { ...book, omnibus };
  return book;
};

// Viz numbered Dragon Ball Z on from 1, though it carries on from Dragon Ball
// (DBZ 1 is Dragon Ball 17), and AniList keeps them as one series
const RENUMBERED: Record<
  string,
  { series: string; after: number; upTo: number }
> = { "dragon ball z": { series: "Dragon Ball", after: 16, upTo: 26 } };
const renumbered = (book: Book): Book => {
  const to = book.lightNovel ? undefined : RENUMBERED[seriesKey(book.series)];
  const held = book.holds ?? (book.volume != null ? [book.volume] : []);
  // whole volumes only: a "10.5" special isn't one of Dragon Ball's
  if (
    !to ||
    !held.length ||
    Math.max(...held) > to.upTo ||
    !held.every(Number.isInteger)
  )
    return book;
  return {
    ...book,
    series: to.series,
    names: [to.series],
    volume: book.volume! + to.after,
    ...(book.holds ? { holds: book.holds.map((v) => v + to.after) } : {}),
  };
};

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
  // the volumes each name has, for a number that fills a gap in a longer name
  // "Trapped in a Dating Sim: The World…" carries on from "Trapped in a
  // Dating Sim" after a colon or dash; "Dragon Ball Super" just carries on,
  // so it's another series
  const subtitled = (longer: string, short: string) => {
    for (let i = 1; i <= longer.length; i++) {
      if (seriesKey(longer.slice(0, i)) === seriesKey(short)) {
        return /^\s*[:\-–—(]/.test(longer.slice(i));
      }
    }
    return false;
  };
  const volumesBy = new Map<string, { name: string; volumes: Set<number> }>();
  books.forEach((book) => {
    if (book.guessed) return;
    for (const name of book.names) {
      // a light novel's names are its own: a manga never joins one
      const k = `${formatOf(book)}:${seriesKey(name)}`;
      const at = volumesBy.get(k) ?? { name, volumes: new Set<number>() };
      for (const v of book.holds ?? (book.volume != null ? [book.volume] : []))
        at.volumes.add(v);
      volumesBy.set(k, at);
    }
  });
  // "Trapped in a Dating Sim 4", alone, is volume 4 of the one longer series
  // that starts with its name and has 4 missing: "Trapped in a Dating Sim:
  // The World of Otome Games Is Tough for Mobs" with 1-3 and 5-7
  const gapIn = (book: Book) => {
    const k = seriesKey(book.series);
    const v = book.volume;
    if (!k || !v) return null;
    const format = formatOf(book);
    const longer = [...volumesBy].filter(([key]) =>
      key.startsWith(`${format}:${k} `),
    );
    if (longer.length !== 1) return null;
    const { name, volumes } = longer[0]![1];
    if (!subtitled(name, book.series)) return null;
    // a real run of volumes, with this one missing from the middle
    return volumes.size >= 2 && !volumes.has(v) && v < Math.max(...volumes)
      ? name
      : null;
  };
  return books.map(({ guessed, ...book }, i) => {
    const asWritten = whole[i];
    if (!guessed || !asWritten) return book;
    if (book.names.some((n) => (seen.get(seriesKey(n)) ?? 0) > 1)) return book;
    const longer = gapIn(book);
    if (longer) return { ...book, series: longer, names: [longer] };
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

// a series named by its subtitle alone joins the full name in the import:
// "Record of the Last Hero, Vol. 5" is "Junk: Record of the Last Hero", and
// "Zero 2: The Beginning of the Coffin" is volume 2 of "Zero: The Beginning
// of the Coffin". Only a numbered volume the full series doesn't have yet, so
// the novel "Before the Fall" stays apart from Attack on Titan's, and only a
// subtitle of a few words, so "Zero" never joins "Fairy Tail: Zero"
function joinSubtitleNames(books: Book[]): Book[] {
  const at = (b: Book, name: string) => `${formatOf(b)}:${seriesKey(name)}`;
  // every full name, its volumes, and which full names each subtitle has
  const volumes = new Map<string, { name: string; held: Set<number> }>();
  const bySubtitle = new Map<string, Set<string>>();
  for (const b of books)
    for (const name of b.names) {
      const k = at(b, name);
      const v = volumes.get(k) ?? { name, held: new Set<number>() };
      for (const n of b.holds ?? (b.volume != null ? [b.volume] : []))
        v.held.add(n);
      volumes.set(k, v);
      const after = /^[^:]+:\s*(.+)$/.exec(name)?.[1];
      if (after)
        bySubtitle.set(
          at(b, after),
          (bySubtitle.get(at(b, after)) ?? new Set()).add(k),
        );
    }
  const fits = (k: string, volume: number) =>
    volumes.get(k) && !volumes.get(k)!.held.has(volume)
      ? volumes.get(k)!.name
      : null;
  return books.map((book) => {
    const others = book.names.filter((n) => n !== book.series);
    const numbered = /^(.+?)\s+(\d{1,3}):\s*(.+)$/.exec(book.series);
    if (numbered && book.volume == null) {
      const volume = Number(numbered[2]);
      const whole = fits(at(book, `${numbered[1]}: ${numbered[3]}`), volume);
      if (whole)
        return { ...book, series: whole, names: [whole, ...others], volume };
    }
    if (book.series.includes(":")) return book;
    // "Record of the Last Hero 5": a number the file left on the name
    const tail = /^(.*\D)\s+(\d{1,3})$/.exec(book.series);
    const name = book.volume == null && tail ? tail[1]!.trim() : book.series;
    const volume = book.volume ?? (tail ? Number(tail[2]) : null);
    const key = seriesKey(name);
    if (!volume || key.split(" ").length < 2) return book;
    if (key.replace(/ /g, "").length < 10) return book;
    const full = [...(bySubtitle.get(at(book, name)) ?? [])];
    const whole = full.length === 1 ? fits(full[0]!, volume) : null;
    return whole
      ? { ...book, names: [...new Set([...book.names, whole])], volume }
      : book;
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
  // their own backup: read as written, nothing guessed
  if (source === "csv" && isOwnExport(h))
    return body.flatMap((row) => ownExportBooks(h, row));
  const toBook =
    source === "goodreads"
      ? goodreadsBook
      : source === "bookcatalogue"
        ? bookCatalogueBook
        : isBookshelfApp(h)
          ? bookshelfAppBook
          : csvBook;
  return confirmTrailingNumbers(
    body
      .flatMap((row) => toBook(h, row) ?? [])
      .map(withVolumesInside)
      .map(realNames),
  )
    .map(realNames)
    .map(renumbered);
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
const bookId = (b: Book) => `${formatOf(b)}:${b.title.trim().toLowerCase()}`;
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
export function groupBooks(everyBook: Book[]): BookSeries[] {
  // after the files are put together, so a name in one joins another's
  const books = joinSubtitleNames(everyBook);
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
        // "Wolf & Parchment" and "Wolf Parchment" are one series, but two
        // ways to search it
        const k = seriesKey(name) + (name.includes("&") ? " &" : "");
        if (!seriesKey(name)) continue;
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
    const volumesOf = (b: Book) =>
      b.holds ?? (b.volume != null ? [b.volume] : []);
    // the furthest whole volume; a 10.5 or a vol. 0 is owned, not a run
    const furthest = (picked: Book[]) => {
      const numbered = picked.flatMap(volumesOf);
      const whole = numbered.filter((v) => Number.isInteger(v) && v >= 1);
      return Math.floor(
        whole.length ? Math.max(...whole) : numbered.length ? 0 : picked.length,
      );
    };
    const owned = furthest(list.filter((b) => b.owned));
    const ownedBooks = list.filter((b) => b.owned);
    // the numbered ones exactly, gaps and all, even beside a box set that
    // doesn't say what it holds (that one is asked about: omnibus). Null only
    // when no owned book has a number
    const numberedOwned = ownedBooks.filter((b) => b.volume != null);
    const ownedList =
      numberedOwned.length || !ownedBooks.length
        ? [...new Set(numberedOwned.flatMap(volumesOf))].sort((a, b) => a - b)
        : null;
    // on vol. 5 now means 1 to 4 are read, marked or not
    const readingFrom = list.flatMap((b) =>
      b.reading && b.volume != null
        ? [Math.max(0, Math.floor(b.volume) - 1)]
        : [],
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
      // an omnibus that doesn't say what it holds is at least one volume
      ownedVolumes: Math.max(
        0,
        Math.min(
          Math.max(
            owned,
            read,
            ownedBooks.some((b) => b.omnibus) ? ownedBooks.length : 0,
          ),
          999,
        ),
      ),
      ownedList,
      readVolumes: Math.max(0, Math.min(read, 999)),
      score: Math.round(average * 2),
      planned: list.every((b) => b.planned),
      lightNovel,
      ...(list.some((b) => b.omnibus) ? { omnibus: true } : {}),
      // their own export's (ownExportBooks)
      ...(list.some((b) => b.finished) ? { finished: true } : {}),
      ...(list.some((b) => b.chapter)
        ? { chapters: Math.max(...list.map((b) => b.chapter ?? 0)) }
        : {}),
      ...(list.find((b) => b.notes)
        ? { notes: list.find((b) => b.notes)!.notes }
        : {}),
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

// books that go with a series but aren't its manga: a shorter name would find
// the series itself ("Cardcaptors: Cinemanga" isn't Cardcaptor Sakura)
const NOT_THE_MANGA =
  /\b(cine-?manga|anime comics?|film comics?|ani-?manga|fan ?book|guide ?book|(official|character|visual|complete) guide|character (files|book)|art ?book|artworks?|illustrations|data ?book|ultimania|colou?ring book|sketchbook|calendar|novelization)\b/i;

// what matching searches AniList for, in order: its own names, then shorter
// forms, which count only when AniList has something called exactly that, so
// "Star Wars: Thrawn" (or "Star Wars 3") can't turn into some Star Wars manga.
// A shorter form with a subtitle taken off is a cut: what it finds may be the
// series this book is a spin-off of (withoutSpinOffs). Taking off a number on
// the end or the creator's name in front isn't. A book that isn't the manga
// gets no shorter forms
export function searchPlan(s: {
  title: string;
  otherNames: string[];
}): { name: string; exactOnly: boolean; cut?: true }[] {
  const own = [...new Set([s.title, ...s.otherNames])];
  const plan: { name: string; exactOnly: boolean; cut?: true }[] = own.map(
    (name) => ({ name, exactOnly: false }),
  );
  if (NOT_THE_MANGA.test(s.title)) return plan;
  const cuts = new Set([
    s.title.split(/\s*:\s+/)[0]!.trim(),
    s.title.split(/\s+(?:-{1,2}|[–—])\s+/)[0]!.trim(),
  ]);
  for (const name of searchFallbacks(s.title)) {
    if (own.includes(name)) continue;
    plan.push({
      name,
      exactOnly: true,
      ...(cuts.has(name) ? { cut: true } : {}),
    });
  }
  return plan;
}

// the volumes a series' row says it has: those owned, or for a row with none
// owned, those read (a spin-off they've only read still clashes). Owned ones
// alone otherwise: "read up to 13" on Last Order's vol. 13 isn't 1 to 13
const ownedOfRow = (s: BookSeries) => {
  const owned = s.ownedList?.length
    ? s.ownedList
    : Array.from({ length: s.ownedVolumes }, (_, i) => i + 1);
  return new Set(
    owned.length
      ? owned
      : Array.from({ length: s.readVolumes }, (_, i) => i + 1),
  );
};

// a match found only by cutting the title short ("Dance in the Vampire Bund"
// for "…: Forgotten Tales") whose volumes clash with another row of the same
// AniList series is a book AniList doesn't have, not more of that series:
// its vol. 1 isn't the series' vol. 1. Two such books clash with each other
// too (Forgotten Tales and Scarlet Order, both vol. 1), while different
// volumes ("Last Order: Angel Reborn" vol. 1, "…: Angel Eternal" vol. 3) are
// one series. Those that clash count as not on AniList, so they can't fold in
export function withoutSpinOffs<
  M extends { anilistId?: number; shorter?: true } | null | "failed",
>(found: BookSeries[], matches: Map<string, M>): Map<string, M | null> {
  const bySeries = new Map<number, { row: BookSeries; cut: boolean }[]>();
  for (const s of found) {
    const m = matches.get(s.key);
    if (m && m !== "failed" && m.anilistId) {
      bySeries.set(m.anilistId, [
        ...(bySeries.get(m.anilistId) ?? []),
        { row: s, cut: Boolean(m.shorter) },
      ]);
    }
  }
  const volumes = new Map<string, Set<number>>();
  const volumesOf = (s: BookSeries) => {
    if (!volumes.has(s.key)) volumes.set(s.key, ownedOfRow(s));
    return volumes.get(s.key)!;
  };
  const out = new Map<string, M | null>(matches);
  for (const rows of bySeries.values()) {
    if (rows.length < 2) continue;
    for (const { row, cut } of rows) {
      if (!cut) continue;
      const mine = volumesOf(row);
      const clash = rows.some(
        (other) =>
          other.row !== row &&
          [...volumesOf(other.row)].some((v) => mine.has(v)),
      );
      if (clash) out.set(row.key, null);
    }
  }
  return out;
}

// what they changed on a series with Edit, before adding: the series they
// chose themselves (null: not on AniList), and how many volumes they own
// `list`: exactly which, when they typed some with gaps ("1-23, 104")
export type EditOf<M> = { match?: M | null; volumes?: number; list?: number[] };

// the matches as they've edited them: their choice of series in place of the
// import's, then the spin-off check over the lot, so a spin-off is judged
// against what they chose. A series they chose is never a cut match, so the
// check never undoes it
export function withEdits<
  M extends { anilistId?: number; shorter?: true } | null | "failed",
>(
  found: BookSeries[],
  matches: Map<string, M>,
  edits: Map<string, EditOf<Exclude<M, "failed" | null>>>,
): Map<string, M | null> {
  const chosen = new Map<string, M | null>(matches);
  for (const [key, edit] of edits)
    if (edit.match !== undefined) chosen.set(key, edit.match as M | null);
  return withoutSpinOffs(found, chosen);
}

// the row's edit, from any series in it (they're saved on all of them)
export const editOf = <E>(s: BookSeries, edits: Map<string, E>) =>
  (s.members ?? [s.key]).map((k) => edits.get(k)).find(Boolean);

// a row with the volume count they gave it. On the row as listed (after
// mergeSameSeries), so a series spelt two ways takes their count, not the
// larger of the two. Volumes owned means it's no longer only on a to-read list
export function withVolumes(
  s: BookSeries,
  edits: Map<string, { volumes?: number; list?: number[] }>,
): BookSeries {
  const edit = editOf(s, edits);
  if (edit?.volumes === undefined) return s;
  const list = edit.list?.length ? edit.list : null;
  return {
    ...s,
    ownedVolumes: edit.volumes,
    ownedList: list,
    omnibus: false,
    planned: s.planned && edit.volumes === 0 && !list,
  };
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
      const copy = { ...s, members: [s.key] };
      if (key) byId.set(key, copy);
      out.push(copy);
      continue;
    }
    first.members!.push(s.key);
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
    if (s.omnibus) first.omnibus = true;
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
  finished: Boolean(s.finished),
  ...(s.planned ? { planned: true } : {}),
  ...(s.lightNovel ? { lightNovel: true } : {}),
  chapters: s.chapters ?? 0,
  ...(s.notes ? { comments: s.notes } : {}),
  readVolumes: s.readVolumes,
  ownedVolumes: s.ownedVolumes,
  // only with gaps: a run from 1 is what ownedVolumes says already, and keeps
  // counting a volume read further on as theirs, as it always did
  // cleaned the server's way first: a "2049" guessed from a title would
  // otherwise turn the whole batch away
  ...(gapsIn(s.ownedList)
    ? { ownedList: ownedVolumes(null, s.ownedList).ownedList }
    : {}),
  score: s.score,
});

// owned volumes that aren't a run from 1
export const gapsIn = (list: number[] | null | undefined) =>
  Boolean(list?.length) && ownedVolumes(null, list).ownedList.length > 0;
