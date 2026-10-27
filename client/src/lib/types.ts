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
  // the chapter they're on
  bookmark: number | null;
  // the last volume they own; null when they don't say
  volumesOwned: number | null;
  rating: number | null;
};

// what the add / edit forms send
export type MangaForm = {
  name: string;
  genre?: string;
  description?: string;
  image?: string;
  status: boolean;
  bookmark?: string | number;
  volumesOwned?: string | number;
};

// the cheapest known price for a shelf card, keyed by manga id
export type ShelfPrice = {
  fromCents: number;
  isbn13: string;
  title: string;
  volume: number | null;
};

export type ShelfMatch = {
  id: number;
  name: string;
  bookmark: number | null;
  status: boolean;
  volumesOwned: number | null;
} | null;

export type Prefs = { background?: Background; theme?: Theme };
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

// only sent when there's at least one sample (stats is null otherwise),
// so every number here is filled in
export type PriceStats = {
  samples: number;
  lowCents: number;
  highCents: number;
  avgCents: number;
  medianCents: number;
  lowAt: string;
  highAt: string;
  since: string;
  lastSeen: string;
  changes: number;
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
  stats: PriceStats | null;
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
