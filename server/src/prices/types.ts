// Shapes shared across the price checker.

// "set": a box set or run of volumes holding this one (eBay), shown and
// labelled but never counted as this volume's price
export type Format = "print" | "ebook" | "set";
// "marketplace" = a resale site (eBay sellers, Mercari, ...), mostly used
type Condition = "new" | "used" | "marketplace";

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
type BookRef = { isbn13: string; title: string };

// a price source. Each switches itself on when its keys are in .env
export interface Provider {
  id: string;
  // the store name shown when this provider is live
  store: string;
  enabled(): boolean;
  fetchOffers(
    isbn13: string,
    signal: AbortSignal,
    book: BookRef,
  ): Promise<Offer[]>;
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
  // how long the book is, when the catalog says: a light novel runs about 230
  // to 400 pages, a manga volume about 130 to 200 (see service.ts)
  pages?: number | null;
  // the record says it's a comic ("(comic)", "(manga)"): never a novel
  comic?: boolean;
  // this volume comes inside a book holding several ("Vinland Saga, Book 9"
  // is vols 17 and 18): every volume it holds is listed with the book's ISBN
  inBook?: { book: number; from: number; to: number };
  // the publisher's release date ("2027-03-30", or just "2014-05"), when the
  // catalog says: a later one is a preorder
  published?: string;
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
  // its name in its own script ("ヴィンランド・サガ"): Open Library files some
  // US editions under it. Missing from rows saved before it was asked for
  nativeName?: string | null;
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
  // named "… Light Novel" (prices/lightNovel.ts)
  lightNovel?: boolean;
};
