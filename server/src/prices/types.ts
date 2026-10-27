// Shapes shared across the price checker.

export type Format = "print" | "ebook";
// "marketplace" = a resale site (eBay sellers, Mercari, ...), mostly used
export type Condition = "new" | "used" | "marketplace";

// one store's price for one volume, as a provider reports it
export type Offer = {
  store: string;
  format: Format | string;
  condition: Condition | string;
  priceCents: number;
  currency: string;
  inStock: boolean;
  url: string | null;
};

// what providers get to know about the volume being priced
export type BookRef = { isbn13: string; title: string };

// a price source. Each switches itself on when its keys are in .env
export interface Provider {
  id: string;
  // the store name shown when this provider is live
  store: string;
  enabled(): boolean;
  fetchOffers(isbn13: string, signal: AbortSignal, book: BookRef): Promise<Offer[]>;
}

// a volume as found in the catalog (Open Library)
export type CatalogBook = {
  isbn13: string;
  title: string;
  authors: string | null;
  publisher: string | null;
  year: number | null;
  volume: number | null;
  coverUrl: string;
};

// a series as AniList describes it, cached in series_info.info
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

// a series in search results and the trending row
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
