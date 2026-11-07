// Stores and search APIs list volumes by title, not ISBN, so these helpers
// decide whether a listing is the same volume we're pricing:
// same series name and same volume number.

export const normalize = (s: string) =>
  s
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
  /\b(box(ed)?\s*set|set of|collection|bundle|lot of|omnibus|\d+\s*[-–~]\s*\d+|\d+\s*(?:and|&)\s*\d+|vol(ume)?s\b)/i;
export const isSingleVolume = (listingTitle: string) =>
  !MULTI_VOLUME.test(listingTitle);

// Japanese-language imports show up for popular series
export const JAPANESE_EDITION =
  /\bjapanese\b|[぀-ヿ一-龯]|japanzon|kanji hunter/i;

// the volume number a listing spells out, undefined when it doesn't
// "Vol. 9", "#9", or "Book 9" (a book holding several volumes, numbered as
// its publisher does: see bookNumberOf)
const statedVolume = (listingTitle: string) =>
  listingTitle.match(/(?:\bvol(?:ume)?\.?|#|\bbook)\s*(\d+)/i)?.[1];

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

// "Frieren: Beyond Journey's End" -> "frieren-beyond-journey-s-end"
export const slugify = (name: string) =>
  name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
