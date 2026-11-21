// The shapes the API sends back. Mirrors server/src (Prisma models and
// prices/service.ts); update both sides together.
// server/src/tests/contract/apiTypes.ts fails the typecheck when one it lists
// differs; a new shape the server sends should get a line there too.
import type { ShelfSort } from "./shelf";

// ---------- the shelf ----------

import type { OwnedBook } from "./books";

export type Manga = {
  id: number;
  userId: number | null;
  name: string;
  genre: string | null;
  description: string | null;
  image: string | null;
  // true = finished reading
  status: boolean;
  // on their To read list: not started yet
  planned: boolean;
  // a light novel rather than a manga
  lightNovel?: boolean;
  // the chapter they're on
  bookmark: number | null;
  // the edition they collect: a line's key ("deluxe"), "singles", or not
  // chosen yet (lib/editions.ts)
  edition?: string | null;
  // the edition they own most of it in, for the stamp on its card
  // ("Definitive +2"); null when that's single volumes. From the server
  editionStamp?: { label: string; short: string; more: number } | null;
  // where they are in the edition they collect, for a card: the book their
  // read volume is in, and the books they own when it's whole books only
  // (the server's util/shelf/editionPlace.ts). Null for single volumes
  editionPlace?: {
    label: string;
    read: number | null;
    owned: number[] | null;
    // for the New tab, in the edition's books: the next one, how many they
    // don't have, and the furthest they do
    next?: number | null;
    behind?: number;
    upTo?: number | null;
    // the day their next book came out or comes out, when a catalog says
    nextPublished?: string | null;
    // that book's ISBN and title, for its price page
    nextIsbn13?: string | null;
    nextTitle?: string | null;
    // the books out that they don't have, for the New tab's list
    toGet?: EditionBookToGet[];
    // the volumes in each of its books that are out, in order (the Volumes
    // tab's bar); missing from an older server
    books?: number[][];
  } | null;
  // the series it's an entry of, edition or not: two entries with the same
  // key are one series ("Vagabond" and "Vagabond VIZBIG Edition"), and the
  // shelf offers to merge them. `plainName`: its name without the edition's
  // words, when it has any
  seriesKey?: string;
  plainName?: string | null;
  // their place kept by the volume instead of the chapter, and the last
  // volume read
  byVolume?: boolean;
  readVolume?: number | null;
  // the last volume they own; null when they don't say
  volumesOwned: number | null;
  // exactly which, when it isn't a run from 1 (lib/ownedVolumes.ts)
  ownedList?: number[];
  // ordered and on their way: Buy next goes past them. Owning one takes it
  // off (the server does)
  orderedList?: number[];
  rating: number | null;
  // when they last changed it: the shelf's "Last updated" order. ISO text;
  // missing on a shelf loaded before the server sent it
  updatedAt?: string;
  // the newest release they've hidden
  seenVolume?: number | null;
  seenChapter?: number | null;
  seenJapanVolume?: number | null;
  // volumes hidden one at a time, on top of everything up to seenVolume
  hiddenVolumes?: number[];
  // the latest chapter last found for this series
  latestChapter?: number | null;
  // its books, on a series just deleted: the undo puts them back
  books?: OwnedBook[];
};

// when the next chapter or volume is due. Dates are ISO, null if there isn't one
type ReleaseEstimate = {
  releaseDate: string | null;
  isEstimate: boolean;
};

// the release dates MangaDex gave us for a series
export type ReleaseData = {
  volume?: { volume: string | null; releaseDate: string | null }[];
  // where each volume starts, by chapter (lib/chapterVolumes.ts)
  volumeStarts?: { volume: number; firstChapter: number }[];
  // the series has ended (MangaUpdates): nothing more is coming
  seriesFinished?: boolean;
  newVolume?: ReleaseEstimate & { volume: string | null };
  chapter?: {
    latestReleased: {
      chapterNumber: string | null;
      releaseDate: string | null;
    };
    estimateRelease: ReleaseEstimate & { chapterNumber: string | null };
  };
};

// what's new in English for this reader
export type ReleaseStatus = {
  // Never sent by the server: put on by lib/editionNews.ts for a series
  // collected as an edition that has a book still to get. The New tab then
  // counts and names in that edition's books ("VIZBIG 5", 8 to get)
  editionBooks?: {
    label: string;
    next: number;
    behind: number;
    // the next book's ISBN and title: its price page is where the card goes
    isbn13?: string | null;
    title?: string | null;
    // every book out that they don't have, in order (the list a card opens)
    toGet?: EditionBookToGet[];
  };
  hasNewVolume: boolean;
  hasNewChapter: boolean;
  // out in Japan past what they own and what's in English; a blank on the shelf
  // counts as owning nothing
  hasNewJapaneseVolume: boolean;
  // on the New tab but for "Hide": listed and not new means they've hidden it
  volumeListed: boolean;
  chapterListed: boolean;
  japanListed: boolean;
  // the panel on the details page: they're on the volume right before the newest
  isNextVolumeOut: boolean;
  // how far they've got: what they own, or else the volume their chapter is in
  currentVolume: number | null;
  latestVolume: number | null;
  // the chapter after theirs, up to the latest
  nextChapter: number | null;
  // the volume that chapter is in, when known (server releaseStatus.ts)
  nextChapterVolume?: number | null;
  // for someone reading by the chapter with no books: the chapters in the
  // next volume ("to" null for the newest, whose end isn't known yet)
  nextVolumeChapters?: { from: number; to: number | null } | null;
  // the next English volume after where they are, and its price page
  nextVolume: number | null;
  nextVolumeBook?: { isbn13: string; title: string } | null;
  // the book of two or three that volume is sold in, when it isn't sold on
  // its own (Vinland Saga's Book 8 holds vols. 15 and 16)
  nextVolumeInBook?: InBook | null;
  // English volumes out below their furthest that they don't own (a gap
  // at 12): counted in "N to get", listed first. Saved answers from before
  // have none
  gapVolumes?: { volume: number; isbn13?: string; title?: string }[];
  // set only on the copy shown to a reader who fills gaps first (Settings):
  // nextVolume is then their first gap (lib/releaseMath.ts withGapFirst)
  nextIsGap?: boolean;
  // every English volume past where they are: how far behind they are, and
  // the list a card opens
  outVolumes: { volume: number; isbn13?: string; title?: string }[];
  // the same for what's only out in Japan
  outJapanVolumes: number[];
  latestChapter: number | null;
  latestJapaneseVolume: number | null;
  // for the Chapters list (server releaseStatus.ts), when the chapter list
  // is sure: the volume their chapter is in; the English books holding
  // their next chapter and on; the chapters out past the newest English
  // volume. Saved answers from before have none
  readingVolume?: number | null;
  chapterBooks?: {
    volume: number;
    label: string;
    isbn13?: string;
    title?: string;
    chapters: { from: number; to: number | null } | null;
  }[];
  chaptersPastEnglish?: {
    volume: number;
    endsAt: number;
    from: number;
    to: number;
  } | null;
};

// what the add / edit forms send
export type MangaForm = {
  name: string;
  genre?: string;
  description?: string;
  image?: string;
  status: boolean;
  planned?: boolean;
  lightNovel?: boolean;
  bookmark?: string | number;
  byVolume?: boolean;
  readVolume?: string | number;
  volumesOwned?: string | number;
  ownedList?: number[];
  // 1 to 5 stars, given on adding it
  rating?: number;
};

// a scanned barcode's book: GET /api/prices/scan/:isbn
export type ScannedBook = {
  isbn13: string;
  title: string;
  // the first volume it holds; null only when `unsure` and its title names
  // no number
  volume: number | null;
  // The app can't tell which volumes this book holds (an edition whose
  // books vary, with nothing saying): `volumes` is then empty, nothing goes
  // on the shelf, and the scan asks. `edition` and `bookNumber` say which
  // book it is ("Deluxe", 2)
  unsure?: boolean;
  edition?: string | null;
  bookNumber?: number | null;
  // every volume it holds: one, or several for a book like "Vinland Saga,
  // Book 9" (vols 17 and 18)
  volumes: number[];
  // the price checker's name ("Overlord Light Novel"), for /api/manga/match
  series: string;
  // the name a shelf keeps it under
  shelfName: string;
  lightNovel: boolean;
  coverUrl: string | null;
};

export type ShelfMatch = {
  id: number;
  name: string;
  bookmark: number | null;
  byVolume?: boolean;
  readVolume?: number | null;
  status: boolean;
  planned?: boolean;
  volumesOwned: number | null;
  ownedList?: number[];
} | null;

// what the New tab lists; see server/src/util/releaseStatus.ts
export type RangeMode = "next" | "within";
export type ReleaseRange = { mode: RangeMode; within: number };
export type ReleaseSettings = { volumes: ReleaseRange; chapters: ReleaseRange };

export type ShelfTab = "all" | "ongoing" | "finished" | "new";
export type Prefs = {
  background?: Background;
  // "system" follows the device
  theme?: Theme | "system";
  hideEbooks?: "yes" | "no";
  // what the shelf opens on
  shelfTab?: ShelfTab;
  // "" is last updated (SORT_OPTIONS in lib/shelf.ts)
  shelfSort?: ShelfSort;
  // how the shelf lists manga: big covers, or compact rows
  shelfView?: "covers" | "rows";
  // "off": never look up new volumes and chapters
  releaseChecks?: "on" | "off";
  releases?: ReleaseSettings;
  // how they keep their place (lib/reading.ts); "series" unless chosen
  trackBy?: "series" | "chapters" | "volumes" | "both";
  // where they buy: Canada gets Canadian store links beside the US prices
  country?: "us" | "ca";
  // what "Next for you" names when there are gaps: the volume after their
  // furthest ("after", unless chosen) or their first gap
  nextFor?: "after" | "gap";
  // To buy offers to add a series not on the shelf; "off": never asks
  offerAdd?: "on" | "off";
};
export type Background = "sfx" | "ink" | "pages" | "panels";
export type Theme = "light" | "dark";

// express-validator errors and our own errors share this shape
export type ApiError = { error: { msg: string; path?: string }[] };

// ---------- the price checker ----------

export type SeriesInfo = {
  anilistId: number;
  name: string;
  score: number | null;
  popularityRank: number | null;
  genres: string[];
  description: string;
  coverUrl: string | null;
  siteUrl: string;
  status: string | null;
  volumes: number | null;
  altNames: string[];
};

export type SeriesHit = {
  name: string;
  slug: string;
  year?: number | null;
  score: number | null;
  volumes?: number | null;
  status?: string | null;
  coverUrl: string | null;
  thumbUrl?: string | null;
  // a light novel, named "… Light Novel" (see novelParts in lib/prices)
  lightNovel?: boolean;
};

export type CatalogBook = {
  isbn13: string;
  title: string;
  authors: string | null;
  publisher: string | null;
  year: number | null;
  volume: number | null;
  coverUrl: string;
};

// a volume on a series page; the server only lists numbered ones
// a book holding several volumes, as its publisher numbers it: Book 9 is
// vols 17 to 18
export type InBook = { book: number; from: number; to: number };

export type SeriesVolume = {
  isbn13: string;
  title: string;
  volume: number;
  coverUrl: string;
  knownPriceCents: number | null;
  // when that price was checked (prices over 30 days old aren't sent at all)
  knownCheckedAt?: string | null;
  // what it has usually sold for new, from every price recorded: for
  // estimates, when no store has it right now (lib/finishCost.ts)
  recordedCents?: number | null;
  // its cheapest used copy in stock now, when one is known
  usedCents?: number | null;
  // readers' average rating of it (1 to 5), when any have rated it
  rating?: number | null;
  // sold inside a book with others: its ISBN is that book's
  inBook?: InBook;
  // the publisher's release date ("2027-03-30" or "2014-05"), when known
  published?: string;
};

export type Series = {
  name: string;
  slug: string;
  info: SeriesInfo | null;
  incomplete: boolean;
  volumes: SeriesVolume[];
  // box sets and omnibuses found while pricing its volumes, cheapest first,
  // and searches for more; missing from an older API
  boxSets?: BoxSet[];
  boxSetLinks?: StoreLink[];
  // "after the anime" has a page for this series
  hasAnimeAnswer?: boolean;
};

export type BoxSet = {
  store: string;
  priceCents: number;
  format: string;
  condition: string;
  url: string | null;
  affiliate: boolean;
};

export type Offer = {
  store: string;
  format: string;
  condition: string;
  priceCents: number;
  currency: string;
  inStock: boolean;
  url: string | null;
  affiliate: boolean;
  fetchedAt: string;
  // a store readers know by name (Walmart, eBay, Books-A-Million), not some
  // Google Shopping seller. Missing from an older API and Canada's prices
  knownStore?: boolean;
};
// a box set or an omnibus holding the volume among others: listed and
// stamped, never counted as the volume's own price
export const isCollection = (offer: { format: string }) =>
  offer.format === "set" || offer.format === "omnibus";

// one kind of copy's history: every in-stock price we've stored for it.
// "marketplace" covers used copies too
export type KindHistory = {
  kind: "new" | "marketplace" | "ebook";
  listings: number;
  lowCents: number;
  lowAt: string;
  lowStore: string;
  highCents: number;
  highAt: string;
  highStore: string;
  medianCents: number;
};

// only sent when there's at least one stored price (history is null
// otherwise), so `since` and `lastSeen` are always filled in
export type PriceHistory = {
  checks: number;
  since: string;
  lastSeen: string;
  kinds: KindHistory[];
};

export type StoreLink = { store: string; url: string; affiliate: boolean };

export type VolumePrices = {
  // a live check would look again (prices old or missing, a volume we know):
  // the page shows these stored prices first, then asks for one
  refreshable?: boolean;
  // what the page is called: the title, or "Series, Vol. N" when the title
  // has no number. The address stays on book.title
  heading?: string;
  series: { name: string; slug: string; info: SeriesInfo | null };
  volume: number | null;
  // a book holding several volumes, in place of a volume number
  inBook: InBook | null;
  // its release date ("2027-03-30") when it isn't out yet: no prices are
  // checked, the page offers preorder links
  preorder: string | null;
  siblings: SeriesVolume[];
  // a book of an edition ("VIZBIG"): which, and the series' volumes it
  // holds when its line says. Its siblings are then that edition's books
  edition?: { label: string; volumes: number[] | null } | null;
  book: {
    isbn13: string;
    title: string;
    authors: string | null;
    publisher: string | null;
    coverUrl: string | null;
    year: number | null;
  };
  offers: Offer[];
  history: PriceHistory | null;
  checkedAt: string | null;
  liveSources: string[];
  storeLinks: StoreLink[];
};

export type PriceCard = {
  isbn13: string;
  title: string;
  volume: number | null;
  coverUrl: string | null;
  seriesCoverUrl: string | null;
  priceCents: number;
  avgCents: number;
  checkedAt: string;
};

export type Highlights = {
  trending: SeriesHit[];
  deals: PriceCard[];
  recent: PriceCard[];
};

export type SeriesIndexEntry = {
  name: string;
  coverUrl: string | null;
  score: number | null;
  // the score is only the mean of a few raters (server prices/scores.ts)
  fewRaters?: true;
  popularityRank: number | null;
  genres: string[];
  status: string | null;
  volumes: number | null;
  knownVolumes: number;
};

// a book of the edition they collect that's out and not theirs yet
export type EditionBookToGet = {
  number: number;
  isbn13: string | null;
  title: string | null;
};
