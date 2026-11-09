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
const seriesWords = (title: string) => seriesOf(title.replace(SAYS_NOVEL, " "));
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
  /\b(box(ed)?\s*set|set of|collection|bundle|lot|omnibus|\d+\s*[-–~]\s*\d+|\d+\s*(?:and|&)\s*\d+|vol(ume)?s\b)/i;
export const isSingleVolume = (listingTitle: string) =>
  !MULTI_VOLUME.test(listingTitle);

// Japanese-language imports show up for popular series
export const JAPANESE_EDITION =
  /\bjapanese\b|[぀-ヿ一-龯]|japanzon|kanji hunter/i;

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
export const seriesThenVolume = (listingTitle: string, bookTitle: string) => {
  const n = volumeOf(bookTitle);
  const series = seriesWords(bookTitle);
  if (isNaN(n) || !series) return false;
  const escaped = series.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(
    `(^| )${escaped} ((omnibus|vizbig|\\d in 1|manga|comic|light novel|edition) )*(vol(ume)? |v |no |book )?0*${n}( |$)`,
  ).test(normalize(listingTitle.replace(/#/g, " ")));
};

// merchandise that shares a series' name: figures, cards, posters and such
export const NOT_A_BOOK =
  /\b(figures?|figurines?|statues?|trading\s*cards?|cards?|tcg|foil|union\s*arena|weiss|poster|plush|keychains?|key\s*chain|stickers?|acrylic|stand(ee)?|funko|nendoroid|cosplay|costume|shirt|hoodie|dvd|blu-?ray|vinyl|puzzle|pins?|badge|wall\s*scroll|mug|lamp|games?|toys?|anime|dub(bed)?|sub(bed|titled)?|seasons?|episodes?|series\s*\d|ost|soundtrack|cd|discs?|ccg|tin|charms?|prints?|art\s*print|model\s*kit|gashapon)\b/i;
// a set from a title search must say it's books, so "Box Set" means volumes
const SAYS_BOOKS =
  /\b(manga|novels?|books?|vol(ume)?s?|paperbacks?|hardcovers?|english)\b/i;
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
  /\b(omnibus|vizbig|\d\s*-?\s*in\s*-?\s*1)\b|(?<!\d)\d{1,3}-\d{1,3}-\d{1,3}(?![\d-])/i;
const SEVERAL_BOOKS = /\b(box(ed)?\s*set|set|lot|bundle|collection)\b/i;
export const severalBooks = (listingTitle: string) =>
  SEVERAL_BOOKS.test(listingTitle);
export const isOmnibusListing = (listingTitle: string) =>
  OMNIBUS.test(listingTitle) && !SEVERAL_BOOKS.test(listingTitle);
// a volume page that is itself such a book: its own listings are this book,
// not a collection holding it
export const isOmnibusBook = (bookTitle: string) =>
  omnibusVolumes(bookTitle) !== null || OMNIBUS.test(bookTitle);

// a box set, or a run of volumes sold together, that holds this volume: a
// range that covers it ("Vols. 1-16", "1 to 16"), or a box or complete set
// with no range. A mixed lot ("lot of 5") with no range isn't one
const RANGE = /(?<!\d)(\d+)\s*(?:-|–|~|to|thru)\s*(\d+)(?!\d)/gi;
// with no range, only a complete set surely holds this volume: "Box Set 3:
// Thriller Bark to New World" doesn't say which volumes it has
const COMPLETE_SET =
  /\bcomplete\b.*\b(box(ed)?\s*set|set|series|collection)\b/i;
// a listing that sells one volume of many ("Vol 1-26, pick your volume",
// "price for 1 volume only"): its range isn't what's for sale
export const PICK_ONE =
  /\b(pick|choose|select|variations?|you\s*pick|each|individual(ly)?|price\s*for\s*(1|one)|single\s*volumes?|singles)\b/i;
const rangesOf = (listingTitle: string) =>
  [...listingTitle.matchAll(RANGE)]
    .map((m) => [Number(m[1]), Number(m[2])] as const)
    .filter(([from, to]) => from >= 0 && to > from && to <= 200);
// how many volumes a set's ranges hold ("Vol. 7-11, Vol. 12-29": 23), 0 when
// it names none
export const setSize = (listingTitle: string) =>
  rangesOf(listingTitle).reduce((n, [from, to]) => n + to - from + 1, 0);
export const setHolds = (listingTitle: string, bookTitle: string) => {
  if (PICK_ONE.test(listingTitle)) return false;
  const wanted = volumeOf(bookTitle);
  // ISBN-like runs ("978-1-9753...") aren't ranges: only small numbers count
  const ranges = rangesOf(listingTitle);
  if (ranges.length)
    return (
      !isNaN(wanted) &&
      ranges.some(([from, to]) => wanted >= from && wanted <= to)
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
