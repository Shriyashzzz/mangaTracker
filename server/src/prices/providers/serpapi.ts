// SerpApi's Google Shopping search: one call returns listings from many US
// stores (Amazon, Barnes & Noble, Walmart, Target, ...). Needs SERPAPI_API_KEY
// from serpapi.com, and more keys can be added (see serpapiKeys.ts). Each search
// counts against that key's monthly plan, so a key stops at SERPAPI_MONTHLY_LIMIT
// (default 250, the free plan) for the calendar month and the next takes over.
// https://serpapi.com/google-shopping-api
import { JAPANESE_EDITION, listingMatches } from "../match.js";
import {
  dropUnlikelyNew,
  isResaleSite,
  isNotABook,
  plausiblePrice,
} from "../retailers.js";
import type { Offer, Provider } from "../types.js";
import { searchSerpApi, serpApiEnabled } from "./serpapiClient.js";

const USED = /\b(used|pre-?owned|refurbished|second-?hand)\b/i;

// digital storefronts: their "price" is an ebook
const DIGITAL =
  /\b(bookwalker|kindle|kobo|comixology|google play|apple books|nook)\b/i;

// a single paperback volume sits in a narrow band; listings far outside it
// are case packs, collector lots or mislabeled sets. Bulk listings can
// outnumber real ones, so anchor on the cheaper end (25th percentile)
// rather than the median
const withinTypicalRange = (allOffers: Offer[]) => {
  const offers = allOffers.filter((o) => plausiblePrice(o.priceCents));
  const prices = offers
    .filter((o) => o.condition === "new" && o.format === "print")
    .map((o) => o.priceCents)
    .sort((a, b) => a - b);
  if (prices.length < 3) return offers;
  const anchor = prices[Math.floor((prices.length - 1) / 4)]!;
  return offers.filter(
    (o) => o.priceCents >= anchor * 0.4 && o.priceCents <= anchor * 2.2,
  );
};

type ShoppingResult = {
  title?: string;
  source?: string;
  snippet?: string;
  extensions?: string[];
  extracted_price?: number;
  product_link?: string;
};

type SearchResults = { error?: string; shopping_results?: ShoppingResult[] };

const serpapi: Provider = {
  id: "serpapi",
  store: "Google Shopping",
  enabled: serpApiEnabled,

  async fetchOffers(_isbn13, signal, book) {
    if (!book.title) return [];

    const data = await searchSerpApi<SearchResults>(
      {
        engine: "google_shopping",
        q: `${book.title} manga`,
        gl: "us",
        hl: "en",
      },
      signal,
    );
    if (!data) return [];

    // the cheapest matching listing from each store, new and used separately
    const best = new Map<string, Offer>();
    for (const item of data.shopping_results ?? []) {
      if (!item.source || !(item.extracted_price && item.extracted_price > 0)) {
        continue;
      }
      if (!listingMatches(item.title ?? "", book.title)) continue;

      const text = [item.title, item.snippet, ...(item.extensions ?? [])].join(
        " ",
      );
      if (JAPANESE_EDITION.test(`${text} ${item.source}`)) continue;
      if (isNotABook(item.source)) continue;
      const condition = isResaleSite(item.source)
        ? "marketplace"
        : USED.test(text)
          ? "used"
          : "new";
      const format = DIGITAL.test(item.source) ? "ebook" : "print";
      const priceCents = Math.round(item.extracted_price * 100);
      const key = `${item.source}|${condition}`;
      const current = best.get(key);
      if (!current || priceCents < current.priceCents) {
        best.set(key, {
          store: item.source.slice(0, 60),
          format,
          condition,
          priceCents,
          currency: "USD",
          inStock: true,
          url: item.product_link ?? null,
        });
      }
    }
    // unbelievable "new" copies go before the typical range is worked out,
    // so they can't drag it down
    return withinTypicalRange(dropUnlikelyNew([...best.values()]));
  },
};

export default serpapi;
