// Stores and search APIs list volumes by title, not ISBN, so these helpers
// decide whether a listing is the same volume we're pricing:
// same series name and same volume number.

// accents and apostrophes go first, so "Café" is "cafe" and "Cat's" is
// "cats", however a listing writes them
export const normalize = (s: string) =>
  s
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/['’‘`]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

// the volume number in a title, NaN when there is none
export const volumeOf = (title: string): number =>
  Number(
    title.match(/\bvol(?:ume)?\.?\s*(\d+)/i)?.[1] ??
      title.match(/(\d+)\s*$/)?.[1] ??
      NaN,
  );

// a book holding several volumes, as its publisher numbers it: "Vinland Saga,
// Book 9" is vols 17 and 18 in one hardcover. Its number is the book's, never
// a volume's, though a store listing ("Vinland Saga 9") still matches on it
const BOOK = /,\s*book\s+(\d+)\s*$/i;
export const bookNumberOf = (title: string) => {
  const m = title.match(BOOK);
  return m ? Number(m[1]) : null;
};

// an omnibus holding several volumes, as a catalog titles it, and the
// volumes it holds. Either it says ("Includes vols. 10, 11 & 12", "Vols.
// 1-3"), or it lists each volume's own title in brackets: "One Piece, Vol. 1
// (Romance Dawn / Buggy the Clown / Don't Get Fooled Again)" is omnibus 1 of
// three volumes each, so vols 1 to 3. null: a single volume. An empty list:
// an omnibus whose volumes can't be told
export function omnibusVolumes(title: string): number[] | null {
  const said = title.match(
    /\b(?:includes\s+)?vols?\.?\s*(\d+)\s*(?:-|–|to)\s*(\d+)|\bincludes\s+vols?\.?\s*([\d,\s&and]+)/i,
  );
  if (said?.[1] && said[2]) {
    const from = Number(said[1]);
    const to = Number(said[2]);
    if (to > from && to - from <= 4)
      return Array.from({ length: to - from + 1 }, (_, i) => from + i);
  }
  if (said?.[3]) {
    const listed = [...said[3].matchAll(/\d+/g)].map((m) => Number(m[0]));
    if (listed.length >= 2) return listed;
  }
  const titles = title.match(/\(([^()]*\s\/\s[^()]*)\)/);
  if (titles) {
    const count = titles[1]!.split(/\s+\/\s+/).filter(Boolean).length;
    const n = volumeOf(title.replace(titles[0], ""));
    if (count >= 2 && count <= 4 && Number.isFinite(n) && n >= 1)
      return Array.from({ length: count }, (_, i) => count * (n - 1) + 1 + i);
  }
  return /\bomnibus\b/i.test(title) ? [] : null;
}

// the normalized series part of a title, for comparing
export const seriesOf = (title: string) =>
  normalize(
    title
      .replace(BOOK, "")
      .replace(/\(.*?\)/g, "")
      .replace(/,?\s*\bvol(?:ume)?\.?\s*\d+.*$/i, "")
      .replace(/\s\d+\s*$/, ""),
  );

// "Jujutsu Kaisen, Vol. 24 (Shonen Jump)" -> "Jujutsu Kaisen", case kept
export const seriesName = (title: string) =>
  title
    .replace(BOOK, "")
    .replace(/\(.*?\)/g, " ")
    .replace(/,?\s*\bvol(?:ume)?\.?\s*\d+.*$/i, "")
    .replace(/\s+\d+\s*$/, "")
    .replace(/\s+/g, " ")
    .trim();

// a light novel's volumes are named "Overlord Light Novel, Vol. 3" (see
// prices/lightNovel.ts); a store lists it as "Overlord, Vol. 3 (light novel)"
// or plain "Overlord, Vol. 3". So the series is compared by its own name, and
// the format on its own
// "Light novel", "(LN)", "LN Vol. 3" or a bare "Novel", but not "Graphic novel"
const SAYS_NOVEL = /\blight\s*novels?\b|\bln\b|(?<!graphic\s)\bnovels?\b/gi;
const SAYS_MANGA = /\b(manga|comics?|graphic novels?)\b/i;
export const isNovelBook = (bookTitle: string) =>
  /\blight novel$/i.test(seriesName(bookTitle));

// what a shopping search is asked: "manga" steers it off novels and art books
// of the same name, so a light novel's own title ("… Light Novel, Vol. 3")
// goes without it
export const shoppingQuery = (bookTitle: string) =>
  isNovelBook(bookTitle) ? bookTitle : `${bookTitle} manga`;
// the series as matching compares it. With "Vol. N" in the title, a number
// before it is part of the name ("Kaiju No. 8, Vol. 3", "Mob Psycho 100,
// Vol. 2"); only without one is a trailing number the volume ("Blue Lock 4")
const HAS_VOL = /\bvol(?:ume)?\.?\s*\d/i;
const seriesWords = (title: string) => {
  const t = title.replace(SAYS_NOVEL, " ");
  if (!HAS_VOL.test(t)) return seriesOf(t);
  return normalize(
    t
      .replace(BOOK, "")
      .replace(/\(.*?\)/g, "")
      .replace(/,?\s*\bvol(?:ume)?\.?\s*\d+.*$/i, ""),
  );
};
// the same, case kept, for a search ("Kaiju No. 8 vol 3")
export const searchName = (title: string) =>
  HAS_VOL.test(title)
    ? title
        .replace(BOOK, "")
        .replace(/\(.*?\)/g, " ")
        .replace(/,?\s*\bvol(?:ume)?\.?\s*\d+.*$/i, "")
        .replace(/\s+/g, " ")
        .trim()
    : seriesName(title);
// a listing that names the other format: "(manga)" for a novel's volume, or
// "(light novel)" for a manga's
const otherFormat = (listingTitle: string, bookTitle: string) => {
  const saysNovel = (text: string) =>
    new RegExp(SAYS_NOVEL.source, "i").test(text);
  const novel = saysNovel(listingTitle);
  if (isNovelBook(bookTitle)) return !novel && SAYS_MANGA.test(listingTitle);
  // "The Novel's Extra" is a manga: its own name can't count against it
  return novel && !saysNovel(seriesName(bookTitle));
};

// exact series match, for clean catalog titles (Google Books)
export const sameVolume = (a: string, b: string) =>
  !otherFormat(a, b) &&
  seriesWords(a) === seriesWords(b) &&
  (volumeOf(a) === volumeOf(b) || (isNaN(volumeOf(a)) && isNaN(volumeOf(b))));

// box sets, bundles and "vols 1-3" never count as a single volume
const MULTI_VOLUME =
  /\b(box(ed)?\s*set|set of|collection|bundle|lots?|omnibus|complete\s+(set|series|run|collection)|full\s+(set|run|series)|all\s+volumes|vol(ume)?s)\b|(?<!\d)\d{1,3}\s*[-–~]\s*(vol(ume)?\.?\s*)?\d{1,3}(?!\d|\s*(st|nd|rd|th)\b)|(?<!\d)\d{1,3}\s*(?:and|&)\s*(vol(ume)?\.?\s*)?\d{1,3}(?!\d)|\bvol(ume)?s?\.?\s*\d{1,3}\s*,\s*&?\s*\d{1,3}(?!\d)/i;
export const isSingleVolume = (listingTitle: string) =>
  !MULTI_VOLUME.test(listingTitle);

// Japanese-language imports show up for popular series
export const JAPANESE_EDITION =
  /\bjapanese\b|[぀-ヿ一-龯]|japanzon|kanji hunter/i;
// other languages and their imprints, and books sent from Japan. Read on a
// normalized listing with the series' own words taken out (accents gone)
export const FOREIGN_EDITION =
  /\b(espanol|spanish|en espanol|french|francais|italian|italiano|german|deutsch|portugues|portuguese|brasil|chinese|korean|panini|pika|glenat|planeta|norma editorial|carlsen|ivrea|kana|from japan|japan version|original version)\b/;
// a different edition of the volume, named in a listing; a title search
// keeps a listing only when the catalog's title names the same edition.
// Rebinds ("[Royal Edition]", "leather bound") are a third party's, never
// the publisher's book
const EDITIONS =
  /\b(vizbig|omnibus|\d in 1|deluxe|ultimate|collectors?|black edition|cine manga|perfect edition|fullmetal edition|master edition|special edition|limited edition|hardcover edition)\b/g;
export const REBOUND =
  /\b(royal\s*edition|leather\s*bound|rebound|rebind|re bound)\b/;
export const editionsOf = (title: string) =>
  new Set(normalize(title).match(EDITIONS) ?? []);
export const otherEdition = (listingTitle: string, bookTitle: string) => {
  const own = editionsOf(bookTitle);
  return [...editionsOf(listingTitle)].some((e) => !own.has(e));
};

// the volume number a listing spells out, undefined when it doesn't:
// "Vol. 9", "#9", or "Book 9" (a book holding several volumes, numbered as
// its publisher does: see bookNumberOf)
// "Vol. 7" wins over "#9" when a title has both ("Musashi #9 Volume 7")
const statedVolume = (listingTitle: string) =>
  listingTitle.match(/\bvol(?:ume)?\.?\s*(\d+)/i)?.[1] ??
  listingTitle.match(/(?:#|\bbook)\s*(\d+)/i)?.[1];

// for a search by ISBN, where a title can be worded any way at all: only a
// title saying it's a different volume counts against it
export const namesOtherVolume = (listingTitle: string, bookTitle: string) => {
  const wanted = volumeOf(bookTitle);
  const stated = statedVolume(listingTitle);
  return !isNaN(wanted) && stated !== undefined && Number(stated) !== wanted;
};

// looser match for shop listings, which pad titles ("Jujutsu Kaisen, Vol. 24
// (24) Paperback - by Gege Akutami"): the series words must all appear and
// the volume number must match
export const listingMatches = (listingTitle: string, bookTitle: string) => {
  if (MULTI_VOLUME.test(listingTitle)) return false;
  if (otherFormat(listingTitle, bookTitle)) return false;
  const series = seriesWords(bookTitle);
  const words = series.split(" ").filter((w) => w.length > 1);
  const listing = normalize(listingTitle);
  if (!words.every((w) => listing.includes(w))) return false;

  const wanted = volumeOf(bookTitle);
  if (isNaN(wanted)) return true;
  return Number(statedVolume(listingTitle)) === wanted;
};

// for a search by title (eBay, when the ISBN isn't enough), where the other
// format turns up easily. A light novel's listing must say it's a novel. A
// manga's must not, and when the other format is around (the series has
// both, like Overlord) it must say it's manga (or a comic), since a novel's
// listing doesn't always say so. "Light nov…" cut short still counts
// "(Light nov…", or cut before that: "(Lig..." / "(Light" at the very end
const CUT_NOVEL = /\blight\s*nov|\(\s*lig(h|ht)?\s*(\.{2,}|…)?\s*$/i;
export const saysNovel = (title: string) =>
  new RegExp(SAYS_NOVEL.source, "i").test(title) || CUT_NOVEL.test(title);
export const formatFits = (
  listingTitle: string,
  bookTitle: string,
  bothFormatsAround = true,
) => {
  if (otherFormat(listingTitle, bookTitle)) return false;
  if (isNovelBook(bookTitle)) return saysNovel(listingTitle);
  if (CUT_NOVEL.test(listingTitle)) return false;
  return !bothFormatsAround || SAYS_MANGA.test(listingTitle);
};

// the series name right before this volume's number ("Overlord, Vol. 16",
// "Overlord #16"), so other books sharing a word ("Primordial Overlord: A
// Cultivation Saga, Volume 16") don't pass
// The series has to open the listing, after at most a few words sellers put
// first ("NEW", "Sealed", "English", a publisher), so another book ending in
// the name ("Kenka Bancho Otome: Love's Battle Royale, Vol. 1") or a spin-off
// ("Wolf and Parchment: New Theory Spice and Wolf") doesn't pass. A listing
// opening with the author is still found by the ISBN search
const LEADING =
  "((new|brand|sealed|english|eng|manga|used|like|very|good|book|books|lot|viz|media|yen|press|kodansha|tokyopop|seven|seas|dark|horse|the) )*";
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
export const opensWithSeries = (listingTitle: string, bookTitle: string) => {
  const series = seriesWords(bookTitle);
  return (
    !!series &&
    new RegExp(`^${LEADING}${escapeRe(series)}( |$)`).test(
      normalize(listingTitle),
    )
  );
};
export const seriesThenVolume = (listingTitle: string, bookTitle: string) => {
  const n = volumeOf(bookTitle);
  const series = seriesWords(bookTitle);
  if (isNaN(n) || !series) return false;
  return new RegExp(
    `^${LEADING}${escapeRe(series)} ((omnibus|vizbig|\\d in 1|manga|comic|comics|light novel|novel|edition|english|eng|graphic|paperback|the) )*(vol(ume)? |v ?|no |book )?0*${n}( |$)`,
  ).test(normalize(listingTitle.replace(/#/g, " ")));
};

// merchandise that shares a series' name: figures, cards, posters and such
export const NOT_A_BOOK =
  /\b(figures?|figurines?|statues?|trading\s*cards?|tcg|foil|union\s*arena|weiss|poster|plush|keychains?|key\s*chain|stickers?|acrylic|stand(ee)?|funko|nendoroid|cosplay|costume|shirt|hoodie|dvd|blu-?ray|vinyl|puzzle|pins?|badge|wall\s*scroll|mug|lamp|games?|toys?|dub(bed)?|sub(bed|titled)?|episodes?|ost|soundtrack|cd|discs?|ccg|tin|charms?|art\s*prints?|model\s*kit|gashapon)\b/i;
// a set from a title search must say it's books, so "Box Set" means volumes
const SAYS_BOOKS =
  /\b(manga|novels?|books?|vol(ume)?s?|paperbacks?|hardcovers?|english)\b|\bv\.?\s*\d/i;
export const setOfBooks = (listingTitle: string) =>
  SAYS_BOOKS.test(listingTitle) && !NOT_A_BOOK.test(listingTitle);

// A listing with the series' own name taken out, for tests that a word in
// that name would trip: "Is It Wrong to Try to Pick Up Girls in a Dungeon?"
// isn't a "pick your volume" listing, "No Game No Life" isn't a game, and
// "Musashi #9 Vol. 7" is volume 7.
// - withoutSeriesWords: every word of the name, wherever it is (titles get
//   cut short: "Is It Wrong to Try to Pick Up Girls i..."), for keywords
// - withoutSeriesName: the name as a whole, so a number in it goes but the
//   volume's own number stays, for reading volumes
export const withoutSeriesWords = (listingTitle: string, bookTitle: string) => {
  const words = new Set(seriesWords(bookTitle).split(" "));
  return normalize(listingTitle)
    .split(" ")
    .filter((w) => !words.has(w))
    .join(" ");
};
export const withoutSeriesName = (listingTitle: string, bookTitle: string) => {
  const words = seriesWords(bookTitle).split(" ").filter(Boolean);
  if (!words.length) return listingTitle;
  const name = new RegExp(
    words
      .map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
      .join("[^a-z0-9]+"),
    "i",
  );
  return listingTitle.replace(name, " ");
};

// the series' words all appear in a listing's title
export const namesSeries = (listingTitle: string, bookTitle: string) => {
  const listing = normalize(listingTitle);
  return seriesWords(bookTitle)
    .split(" ")
    .filter((w) => w.length > 1)
    .every((w) => listing.includes(w));
};

// one book holding several volumes, as a listing names it: an omnibus, a
// "3-in-1", a VIZBIG edition, or volumes joined in its own name ("One Piece:
// East Blue 1-2-3"). Not a set of books (a box, a lot, a bundle)
const OMNIBUS =
  /\b(omnibus|vizbig|\d\s*-?\s*in\s*-?\s*1|black\s+edition|ultimate\s+edition)\b/i;
// "1-2-3": three volumes in a row, from 1 up. A longer run ("1-6-7-8-10", a
// lot) or a code ("C: 0-1-2") isn't one book
const JOINED = /(?<![\d-])(\d{1,3})-(\d{1,3})-(\d{1,3})(?![\d-])/;
const joinedVolumes = (title: string) => {
  const m = title.match(JOINED);
  if (!m) return false;
  const [a, b, c] = [Number(m[1]), Number(m[2]), Number(m[3])];
  return a >= 1 && b === a + 1 && c === b + 1;
};
const SEVERAL_BOOKS = /\b(box(ed)?\s*set|set|lot|bundle|collection)\b/i;
export const severalBooks = (listingTitle: string) =>
  SEVERAL_BOOKS.test(listingTitle);
export const isOmnibusListing = (listingTitle: string) =>
  (OMNIBUS.test(listingTitle) || joinedVolumes(listingTitle)) &&
  !SEVERAL_BOOKS.test(listingTitle);
// a volume page that is itself such a book: its own listings are this book,
// not a collection holding it
export const isOmnibusBook = (bookTitle: string) =>
  omnibusVolumes(bookTitle) !== null ||
  OMNIBUS.test(bookTitle) ||
  joinedVolumes(bookTitle);

// what a listing must call itself to be shown as a box set, read on top of
// its range: a seller's lot of whatever volumes they had ("Bleach Vol. 8-10
// & 22 ... Book Lot") holds a range too, but isn't one. Read with the
// series' own words taken out (withoutSeriesWords), so a name can't say it
const SAYS_BOX_SET = /\bbox(ed)?\b|\bcompleted?\b/i;
const SAYS_LOT =
  /\b(lot|lots|bundle|loose|mixed|assorted|random|singles?|used\s+books)\b/i;
// "Box" says it; "complete" alone only for a whole run from volume 1 (or
// one naming no range), so "Manga Set - Complete - Vol 1-5, 8 & 20" isn't
// one. A set's volumes are also one unbroken run: gaps make it a lot
export const saysBoxSet = (bareListing: string, listingTitle: string) => {
  if (!SAYS_BOX_SET.test(bareListing) || SAYS_LOT.test(bareListing))
    return false;
  const runs = mergedRuns(listingTitle);
  if (runs.length > 1) return false;
  if (/\bbox(ed)?\b/i.test(bareListing)) return true;
  return !runs.length || runs[0]![0] <= 1;
};

// a set is this series' own, not a sequel's or a spin-off's ("Tokyo Ghoul:re
// Complete Box Set" on Tokyo Ghoul's page): right after the series name
// comes a word about the set itself, not more name
const AFTER_NAME =
  /^(box(ed)?|complete(d)?|season|part|the|manga|comics?|graphic|light|novels?|vols?|volumes?|v|by|english|eng|set|series|collection|deluxe|edition|books?|paperbacks?|hardcovers?|hardback|official|viz|kodansha|yen|\d+)$/;
export const ownSeriesSet = (listingTitle: string, bookTitle: string) => {
  const series = seriesWords(bookTitle);
  const listing = ` ${normalize(listingTitle)} `;
  const at = listing.indexOf(` ${series} `);
  if (!series || at < 0) return false;
  // and it opens the title, as a single copy's must ("The Complete Chi's
  // Sweet Home Box Set" too)
  if (
    !new RegExp(`^${LEADING}((the|complete|completed|official) )*$`).test(
      `${listing.slice(1, at + 1).trimStart()}`,
    )
  )
    return false;
  const next = listing
    .slice(at + series.length + 2)
    .trim()
    .split(" ")[0];
  return !next || AFTER_NAME.test(next);
};

// a box set, or a run of volumes sold together, that holds this volume: a
// range that covers it ("Vols. 1-16", "1 to 16"), or a box or complete set
// with no range. A mixed lot ("lot of 5") with no range isn't one
const RANGE =
  /(?<!\d)(\d+)\s*(?:-|–|~|to|thru)\s*(?:vol(?:ume)?\.?\s*)?(\d+)(?!\d|\s*(?:st|nd|rd|th)\b)/gi;
// with no range, only a complete set surely holds this volume: "Box Set 3:
// Thriller Bark to New World" doesn't say which volumes it has
const COMPLETE_SET =
  /\bcomplete\b.*\b(box(ed)?\s*set|set|series|collection)\b/i;
// a listing that sells one volume of many ("Vol 1-26, pick your volume",
// "price for 1 volume only"): its range isn't what's for sale
export const PICK_ONE =
  /\b(pick|choose|select|variations?|you\s*pick|your\s*choice)\b/i;
// on a listing naming a run, these mean one volume of it is for sale; on a
// single copy ("Manga Single Volume", "sold each") they mean nothing
const ONE_OF_RUN =
  /\b(each|individual(ly)?|price\s*for\s*(1|one)|single\s*volumes?|singles)\b/i;
// the volumes a listing names, as ranges: "1-16" and "1 to 16"; a chain
// ("7-8-9", "1-6-7-8-10") is its own numbers; "Vols. 10, 11 & 12" too
const CHAIN = /(?<![\d-])\d{1,3}(?:\s*-\s*\d{1,3}){2,}(?![\d-])/g;
const LISTED = /\bvol(?:ume)?s?\.?\s*(\d{1,3}(?:\s*(?:,|&|and)\s*\d{1,3})+)/gi;
const SEQUENCE =
  /(?<![\d-])\d{1,3}(?:\s*[-–]\s*\d{1,3})?(?:\s*(?:,|&|\band\b)\s*\d{1,3}(?:\s*[-–]\s*\d{1,3})?(?![\d-]))+/gi;
const rangesOf = (listingTitle: string) => {
  const ranges: (readonly [number, number])[] = [];
  let rest = listingTitle.replace(CHAIN, (chain) => {
    for (const n of chain.split("-")) ranges.push([Number(n), Number(n)]);
    return " ";
  });
  rest = rest.replace(LISTED, (_, list: string) => {
    for (const n of list.match(/\d+/g) ?? [])
      ranges.push([Number(n), Number(n)]);
    return " ";
  });
  // a list mixing runs and single volumes: "Vol 1-5, 8 & 20"
  rest = rest.replace(SEQUENCE, (list) => {
    for (const part of list.split(/\s*(?:,|&|\band\b)\s*/)) {
      const [a, b] = part.split(/\s*[-–]\s*/).map(Number);
      if (a === undefined || isNaN(a)) continue;
      const to = b === undefined || isNaN(b) ? a : b;
      if (to >= a && to <= 200) ranges.push([a, to]);
    }
    return " ";
  });
  for (const m of rest.matchAll(RANGE)) {
    const [from, to] = [Number(m[1]), Number(m[2])];
    if (from >= 0 && to > from && to <= 200) ranges.push([from, to]);
  }
  return ranges;
};
// a listing that can be this omnibus page's own book: the volumes it names
// fit inside the page's, or (when the page's can't be told) are few enough
// for one book. "Vagabond VizBig Edition (Vol. 1-12)" isn't VIZBIG 11
export const fitsOmnibusPage = (listingTitle: string, bookTitle: string) => {
  const named = rangesOf(listingTitle);
  if (!named.length) return true;
  const held = pageVolumes(bookTitle);
  // the volumes it names are exactly the page's: "Contains Volumes 9 & 10"
  // for Black Edition 5, not "Vol. 1 & 2" (two books) for a 3-in-1's first.
  // Contents a title gives ("Includes Vols. 1, 2", cut short) may be part
  if (held?.length) {
    if (/\b(includes|contains)\b/i.test(listingTitle))
      return named.every(
        ([from, to]) => from >= Math.min(...held) && to <= Math.max(...held),
      );
    const runs = mergedRuns(listingTitle);
    return (
      runs.length === 1 &&
      runs[0]![0] === Math.min(...held) &&
      runs[0]![1] === Math.max(...held)
    );
  }
  // the page's volumes unknown: one short run at most ("Vol. 1 & 2" of a
  // 3-in-1 is two books)
  return named.length === 1 && named[0]![1] - named[0]![0] < 4;
};

// the volumes a listing names as unbroken runs: "Vol. 7-11, Vol. 12-29" is
// one (7-29); "Vol 1-5, 8 & 20" is three
const mergedRuns = (listingTitle: string) => {
  const runs: [number, number][] = [];
  for (const [from, to] of [...rangesOf(listingTitle)].sort(
    (a, b) => a[0] - b[0],
  )) {
    const last = runs.at(-1);
    if (last && from <= last[1] + 1) last[1] = Math.max(last[1], to);
    else runs.push([from, to]);
  }
  return runs;
};
// how many volumes a set's ranges hold ("Vol. 7-11, Vol. 12-29": 23), 0 when
// it names none
export const setSize = (listingTitle: string) =>
  rangesOf(listingTitle).reduce((n, [from, to]) => n + to - from + 1, 0);
// the volumes a volume page is for: its own number, or an omnibus's volumes.
// null: an omnibus or "Book N" whose volumes can't be told
// how many volumes one book of an edition holds: "3-in-1" 3, VIZBIG 3,
// Black Edition and Ultimate Edition 2
const perBook = (title: string) => {
  const n = title.match(/\b(\d)\s*-?\s*in\s*-?\s*1\b/i)?.[1];
  if (n) return Number(n);
  if (/\bvizbig\b/i.test(title)) return 3;
  if (/\b(black|ultimate)\s+edition\b/i.test(title)) return 2;
  return null;
};
const pageVolumes = (bookTitle: string): number[] | null => {
  const held = omnibusVolumes(bookTitle);
  if (held?.length) return held;
  // "Death Note Black Edition, Vol. 5" holds vols 9 and 10
  const each = perBook(bookTitle);
  const n = volumeOf(bookTitle);
  if (each && !isNaN(n))
    return Array.from({ length: each }, (_, i) => (n - 1) * each + 1 + i);
  if (held) return null;
  if (bookNumberOf(bookTitle) !== null || isOmnibusBook(bookTitle)) return null;
  return isNaN(n) ? [] : [n];
};
export const setHolds = (listingTitle: string, bookTitle: string) => {
  if (PICK_ONE.test(listingTitle) || ONE_OF_RUN.test(listingTitle))
    return false;
  // a set of the page's own edition counts in that edition's numbers: "Death
  // Note Black Edition Complete Set Vol 1-6" holds Black Edition 5. Not
  // another single book of it ("2-in-1 Edition, Vol. 5: Includes Volumes 9
  // & 10" on 2-in-1 Vol. 9's page), which counts in volumes
  const ownEdition =
    perBook(bookTitle) !== null &&
    !isOmnibusListing(listingTitle) &&
    [...editionsOf(listingTitle)].some((e) => editionsOf(bookTitle).has(e));
  const wanted = ownEdition ? [volumeOf(bookTitle)] : pageVolumes(bookTitle);
  // ISBN-like runs ("978-1-9753...") aren't ranges: only small numbers count
  const ranges = rangesOf(listingTitle);
  if (ranges.length)
    return (
      !!wanted?.length &&
      wanted.some((v) => ranges.some(([from, to]) => v >= from && v <= to))
    );
  return COMPLETE_SET.test(listingTitle);
};

// "Frieren: Beyond Journey's End" -> "frieren-beyond-journey-s-end"
export const slugify = (name: string) =>
  name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
