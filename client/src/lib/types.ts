// The shapes the API sends back. Mirrors server/src (Prisma models and
// prices/service.ts); update both sides together.

// ---------- the shelf ----------

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
  // the chapter they're on
  bookmark: number | null;
  // the last volume they own; null when they don't say
  volumesOwned: number | null;
  rating: number | null;
  // the newest release they've hidden
  seenVolume?: number | null;
  seenChapter?: number | null;
  seenJapanVolume?: number | null;
  // volumes hidden one at a time, on top of everything up to seenVolume
  hiddenVolumes?: number[];
  // the latest chapter last found for this series
  latestChapter?: number | null;
};

// when the next chapter or volume is due. Dates are ISO, null if there isn't one
type ReleaseEstimate = {
  releaseDate: string | null;
  isEstimate: boolean;
};

// the release dates MangaDex gave us for a series
export type ReleaseData = {
  volume?: { volume: string | null; releaseDate: string | null }[];
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
  hasNewVolume: boolean;
  hasNewChapter: boolean;
  // out in Japan past what they own and what's in English; a blank on the shelf
  // counts as owning nothing
  hasNewJapaneseVolume: boolean;
  // how their settings ask for each to be listed
  volumeMode: RangeMode;
  chapterMode: RangeMode;
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
  // the next English volume after where they are, and its price page
  nextVolume: number | null;
  nextVolumeBook?: { isbn13: string; title: string } | null;
  // every English volume past where they are, for the grouped entry
  outVolumes: { volume: number; isbn13?: string; title?: string }[];
  // the same for what's only out in Japan
  outJapanVolumes: number[];
  latestChapter: number | null;
  latestJapaneseVolume: number | null;
};

// what the add / edit forms send
export type MangaForm = {
  name: string;
  genre?: string;
  description?: string;
  image?: string;
  status: boolean;
  planned?: boolean;
  bookmark?: string | number;
  volumesOwned?: string | number;
};

export type ShelfMatch = {
  id: number;
  name: string;
  bookmark: number | null;
  status: boolean;
  volumesOwned: number | null;
} | null;

// what the New tab lists; see server/src/util/releaseStatus.ts
export type RangeMode = "next" | "within" | "all";
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
  shelfSort?: string;
  // how the shelf lists manga: big covers, or compact rows
  shelfView?: "covers" | "rows";
  // "off": never look up new volumes and chapters
  releaseChecks?: "on" | "off";
  releases?: ReleaseSettings;
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
export type SeriesVolume = {
  isbn13: string;
  title: string;
  volume: number;
  coverUrl: string;
  knownPriceCents: number | null;
};

export type Series = {
  name: string;
  slug: string;
  info: SeriesInfo | null;
  incomplete: boolean;
  volumes: SeriesVolume[];
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
};

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
  series: { name: string; slug: string; info: SeriesInfo | null };
  volume: number | null;
  siblings: SeriesVolume[];
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
  popularityRank: number | null;
  genres: string[];
  status: string | null;
  volumes: number | null;
  knownVolumes: number;
};
