// SerpApi's Google Shopping search: one call returns listings from many US
// stores (Amazon, Barnes & Noble, Walmart, Target, ...). Needs SERPAPI_API_KEY
// from serpapi.com, and more keys can be added (see serpapiKeys.ts). Each search
// counts against that key's monthly plan, so a key stops at SERPAPI_MONTHLY_LIMIT
// (default 250, the free plan) for the calendar month and the next takes over.
// https://serpapi.com/google-shopping-api
import config from "../../config/config.js";
import priceQueries from "../../models/priceQueries.js";
import { listingMatches } from "../match.js";
import { dropUnlikelyNew, isResaleSite, isNotABook } from "../retailers.js";
import type { Offer, Provider } from "../types.js";
import {
  readAnswer,
  searchWithKeys,
  serpApiKeys,
  usageLabel,
} from "./serpapiKeys.js";

// config has already loaded server/.env by now
const KEYS = serpApiKeys(process.env);
if (KEYS.length > 1) console.log(`SerpApi: ${KEYS.length} keys ready`);
const labelOf = (key: string) => usageLabel(key, config.SERPAPI_API_KEY);

const URL = "https://serpapi.com/search.json";
const USED = /\b(used|pre-?owned|refurbished|second-?hand)\b/i;

// digital storefronts: their "price" is an ebook
const DIGITAL =
  /\b(bookwalker|kindle|kobo|comixology|google play|apple books|nook)\b/i;
// Japanese-language imports show up for popular series
const JAPANESE_EDITION = /\bjapanese\b|[぀-ヿ一-龯]|japanzon|kanji hunter/i;

// any single volume, deluxe editions included, sits inside this. It catches
// bad listings even when there are too few to compare with each other
const MIN_CENTS = 200;
const MAX_CENTS = 7500;

// a single paperback volume sits in a narrow band; listings far outside it
// are case packs, collector lots or mislabeled sets. Bulk listings can
// outnumber real ones, so anchor on the cheaper end (25th percentile)
// rather than the median
const withinTypicalRange = (allOffers: Offer[]) => {
  const offers = allOffers.filter(
    (o) => o.priceCents >= MIN_CENTS && o.priceCents <= MAX_CENTS,
  );
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
  enabled: () => KEYS.length > 0,

  async fetchOffers(_isbn13, signal, book) {
    if (!book.title) return [];

    const data = await searchWithKeys<SearchResults>({
      keys: KEYS,
      // claim a search from this month's budget before spending it
      claim: (key) =>
        priceQueries.claimApiCall(labelOf(key), config.SERPAPI_MONTHLY_LIMIT),
      markSpent: async (key) => {
        console.warn(`SerpApi key ${labelOf(key)} is out of searches this month`);
        await priceQueries.markApiSpent(labelOf(key), config.SERPAPI_MONTHLY_LIMIT);
      },
      search: async (key) => {
        const params = new URLSearchParams({
          engine: "google_shopping",
          q: `${book.title} manga`,
          gl: "us",
          hl: "en",
          api_key: key,
        });
        const res = await fetch(`${URL}?${params}`, { signal });
        const answer = (await res.json().catch(() => ({}))) as SearchResults;
        const error =
          answer.error ?? (res.ok ? undefined : `responded ${res.status}`);
        return { answer: readAnswer(res.status, error), data: answer, error };
      },
    });
    if (!data) {
      console.warn("Every SerpApi key is used up for now, skipping this search");
      return [];
    }

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
