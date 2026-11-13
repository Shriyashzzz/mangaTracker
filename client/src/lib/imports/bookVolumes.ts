// Books that hold several volumes (an omnibus, a 3-in-1, a box set): which
// volumes are inside. Ends with readBooks, which turns a file's rows into
// books. Part of the book import (bookImport.ts lists the parts).
import { type BookSource, type Book } from "./bookTypes";
import {
  tidy,
  withAmpersands,
  seriesFromTitle,
  isName,
  formatOf,
  seriesKey,
} from "./bookNames";
import {
  header,
  cell,
  goodreadsBook,
  bookCatalogueBook,
  isBookshelfApp,
  bookshelfAppBook,
  isOwnExport,
  ownExportBooks,
  csvBook,
} from "./bookColumns";

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
  /\bomnibus\b|\bcomplete collection\b|\bbind-?up\b|\bbox ?set\b|\ball-in-one\b/i;

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
  // Deluxe 14 ends at vol. 41
  {
    series: /^berserk$/,
    edition: /\bdeluxe\b/i,
    perBook: 3,
    books: 14,
    volumes: 41,
  },
  // the 3-in-1 deluxe hardcovers first, then Kodansha's 2-in-1 books: every
  // English "Book N" holds two (Book 9 is vols 17 and 18)
  {
    series: /^vinland saga$/,
    edition: /\bdeluxe\b/i,
    perBook: 3,
    books: 10,
    volumes: 29,
  },
  {
    series: /^vinland saga$/,
    edition: /\bbook\b|\bhardcover\b/i,
    perBook: 2,
    books: 15,
    volumes: 29,
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

// ---------- box sets ----------

// A box set is a series' name, "Box Set", perhaps its number, perhaps what it
// holds: "Naruto Box Set 1: Volumes 1-27". The name is the series' (never
// "One Piece Box Set 2", a series of its own), and its volumes are what the
// title says, or what the publisher's set of that number holds, or else not
// known and asked about. "All-in-One" is the whole series in one book
const BOX_SET =
  /^(.*?)[\s,:(\-–—]+(?:the\s+)?(?:complete\s+)?(?:manga\s+)?(?:box(?:ed)?\s?set|all-in-one(?:\s+edition)?)\)?(?:[\s,:#]*(?:vol(?:ume)?\.?\s*)?(\d{1,2})\b)?(.*)$/i;
const SET_RANGE =
  /\b(?:vol(?:ume)?s?\.?)\s*(\d{1,3})\s*(?:[-–]|to)\s*(\d{1,3})\b/i;
// the publishers' own sets: [first, last] by set number (0: the one complete
// set). Only ones whose contents don't change
const BOX_SETS: Record<string, Record<number, [number, number]>> = {
  naruto: { 1: [1, 27], 2: [28, 48], 3: [49, 72] },
  "one piece": { 1: [1, 23], 2: [24, 46], 3: [47, 70], 4: [71, 90] },
  bleach: { 1: [1, 21], 2: [22, 48], 3: [49, 74] },
  "demon slayer": { 0: [1, 23] },
  "demon slayer kimetsu no yaiba": { 0: [1, 23] },
  "death note": { 0: [1, 12] },
  "dragon ball": { 0: [1, 16] },
  "dragon ball z": { 0: [1, 26] },
  "fullmetal alchemist": { 0: [1, 27] },
  "tokyo ghoul": { 0: [1, 14] },
};
const SET_MAX = 120;

export function boxSetOf(
  title: string,
): { series: string; holds: number[] | null } | null {
  const text = withAmpersands(title.normalize("NFKC"));
  const m = text.match(BOX_SET);
  if (!m) return null;
  const series = tidy(m[1]!);
  if (!series) return null;
  const span = (from: number, to: number) =>
    to >= from && to - from < SET_MAX
      ? Array.from({ length: to - from + 1 }, (_, i) => from + i)
      : null;
  const said = (m[3] ?? "").match(SET_RANGE);
  const known = BOX_SETS[seriesKey(series)]?.[m[2] ? Number(m[2]) : 0];
  return {
    series,
    holds:
      (said && span(Number(said[1]), Number(said[2]))) ??
      (known ? span(known[0], known[1]) : null),
  };
}

const withVolumesInside = (book: Book): Book => {
  const box = boxSetOf(book.title);
  if (box)
    return {
      ...book,
      series: box.series,
      names: [box.series],
      volume: box.holds?.[0] ?? null,
      ...(box.holds ? { holds: box.holds } : { omnibus: true as const }),
      guessed: undefined,
    };
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
export function joinSubtitleNames(books: Book[]): Book[] {
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
    // a backup's names are the shelf's own: never joined by a guess
    if (book.exact) return book;
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
  // any column of ISBNs: each row's goes with its book
  const isbnAt = header(h, /^isbn ?13$/i, /^isbn$/i, /isbn/i);
  const withIsbn = (row: string[], book: Book | null): Book[] => {
    if (!book) return [];
    const isbn = isbnAt < 0 ? "" : cell(row, isbnAt).replace(/[^0-9]/g, "");
    return [/^97[89]\d{10}$/.test(isbn) ? { ...book, isbn } : book];
  };
  return confirmTrailingNumbers(
    body
      .flatMap((row) => withIsbn(row, toBook(h, row)))
      .map(withVolumesInside)
      .map(realNames),
  )
    .map(realNames)
    .map(renumbered);
}
