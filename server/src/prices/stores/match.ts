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

// for a search by title (eBay, when the ISBN isn't enough), where the other
// format turns up easily, so each must say what it is: a light novel's
// listing that it's a novel, a manga's that it's manga (or a comic). "Light
// nov…" cut short still counts as a novel
const CUT_NOVEL = /\blight\s*nov/i;
export const formatFits = (listingTitle: string, bookTitle: string) => {
  if (otherFormat(listingTitle, bookTitle)) return false;
  if (isNovelBook(bookTitle))
    return (
      new RegExp(SAYS_NOVEL.source, "i").test(listingTitle) ||
      CUT_NOVEL.test(listingTitle)
    );
  return SAYS_MANGA.test(listingTitle) && !CUT_NOVEL.test(listingTitle);
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
    `(^| )${escaped} (vol(ume)? |v |no |book )?0*${n}( |$)`,
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

// the series' words all appear in a listing's title
export const namesSeries = (listingTitle: string, bookTitle: string) => {
  const listing = normalize(listingTitle);
  return seriesWords(bookTitle)
    .split(" ")
    .filter((w) => w.length > 1)
    .every((w) => listing.includes(w));
};

// a box set, or a run of volumes sold together, that holds this volume: a
// range that covers it ("Vols. 1-16", "1 to 16"), or a box or complete set
// with no range. A mixed lot ("lot of 5") with no range isn't one
const RANGE = /(?<!\d)(\d+)\s*(?:-|–|~|to|thru)\s*(\d+)(?!\d)/gi;
const BOX_SET = /\b(box(ed)?\s*set|complete\s*(set|series|collection))\b/i;
// a listing that sells one volume of many ("Vol 1-26, pick your volume",
// "price for 1 volume only"): its range isn't what's for sale
const PICK_ONE =
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
  return BOX_SET.test(listingTitle);
};

// "Frieren: Beyond Journey's End" -> "frieren-beyond-journey-s-end"
export const slugify = (name: string) =>
  name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
