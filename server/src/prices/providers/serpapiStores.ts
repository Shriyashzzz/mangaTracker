// Live prices straight from one store, through SerpApi's store searches. Each
// row links to the exact listing, so unlike a Google Shopping row, a click on
// it carries our affiliate tracking. Every search here costs one SerpApi search.
// https://serpapi.com/ebay-search-api
// https://serpapi.com/amazon-search-api
import { amazonTag, ebayAffiliateUrl } from "../stores/affiliates.js";
import {
  JAPANESE_EDITION,
  isSingleVolume,
  listingMatches,
  namesOtherVolume,
} from "../stores/match.js";
import { plausiblePrice } from "../stores/retailers.js";
import type { Offer, Provider } from "../types.js";
import ebayApi from "./ebay.js";
import keepa from "./keepa.js";
import { searchSerpApi, serpApiEnabled } from "./serpapiClient.js";

const toCents = (dollars: number) => Math.round(dollars * 100);

// the cheapest offer for each store + format + condition
const cheapestOfEach = (offers: Offer[]) => {
  const best = new Map<string, Offer>();
  for (const o of offers) {
    const key = `${o.store}|${o.format}|${o.condition}`;
    const current = best.get(key);
    if (!current || o.priceCents < current.priceCents) best.set(key, o);
  }
  return [...best.values()];
};

// ---------- eBay ----------

export type EbayResult = {
  title?: string;
  link?: string;
  product_id?: string;
  condition?: string;
  location?: string;
  shipping?: string | { extracted?: number };
  // a range ({ from, to }) means several variants, so no one price to show
  price?: { extracted?: number; from?: unknown };
};

const shippingCents = (shipping: EbayResult["shipping"]) => {
  if (typeof shipping === "object") {
    return shipping.extracted === undefined ? null : toCents(shipping.extracted);
  }
  return /free/i.test(shipping ?? "") ? 0 : null;
};

// the listing without eBay's tracking, ready for our own
const ebayItemUrl = ({ product_id, link }: EbayResult) => {
  if (product_id) return `https://www.ebay.com/itm/${product_id}`;
  if (!link) return null;
  // one odd link drops that listing, not every eBay price the search paid for
  try {
    const url = new URL(link);
    return `${url.origin}${url.pathname}`;
  } catch {
    return null;
  }
};

// The search is by ISBN, so a differently worded title is still this book. Only
// what the title says is something else gets dropped: sets, other volumes,
// Japanese editions, imports and anything not already in the US
export function ebayOffers(results: EbayResult[], title: string): Offer[] {
  const offers: Offer[] = [];
  for (const item of results) {
    const name = item.title ?? "";
    const price = item.price?.extracted;
    const shipping = shippingCents(item.shipping);
    const url = ebayItemUrl(item);
    if (!price || item.price?.from || shipping === null || !url) continue;
    if (!/united states/i.test(item.location ?? "")) continue;
    if (!isSingleVolume(name) || namesOtherVolume(name, title)) continue;
    if (JAPANESE_EDITION.test(name) || /\bimport\b/i.test(name)) continue;

    const priceCents = toCents(price) + shipping;
    if (!plausiblePrice(priceCents)) continue;
    offers.push({
      store: "eBay",
      format: "print",
      condition: /^brand new/i.test(item.condition ?? "") ? "new" : "used",
      priceCents,
      currency: "USD",
      inStock: true,
      url: ebayAffiliateUrl(url, "listing"),
    });
  }
  return cheapestOfEach(offers);
}

export const ebaySearch: Provider = {
  id: "serpapi-ebay",
  store: "eBay",
  // eBay's own API, once it's set up, says the same thing for free
  enabled: () => serpApiEnabled() && !ebayApi.enabled(),

  async fetchOffers(isbn13, signal, book) {
    const data = await searchSerpApi<{
      error?: string;
      organic_results?: EbayResult[];
    }>(
      {
        engine: "ebay",
        _nkw: isbn13,
        _sop: "15", // price + shipping, lowest first
        buying_format: "BIN", // no auctions: their price isn't the final one
      },
      signal,
    );
    return ebayOffers(data.organic_results ?? [], book.title);
  },
};

// ---------- Amazon ----------

export type AmazonResult = {
  asin?: string;
  title?: string;
  link_clean?: string;
  extracted_price?: number;
};

// the ISBN-10 Amazon files a printed book under, for 978 ISBNs
export function isbn10Of(isbn13: string) {
  if (!isbn13.startsWith("978")) return null;
  const body = isbn13.slice(3, 12);
  const sum = [...body].reduce((n, d, i) => n + Number(d) * (10 - i), 0);
  const check = (11 - (sum % 11)) % 11;
  return `${body}${check === 10 ? "X" : check}`;
}

const amazonUrl = (asin: string) => {
  const tag = amazonTag();
  return `https://www.amazon.com/dp/${asin}${tag ? `?tag=${encodeURIComponent(tag)}` : ""}`;
};

export function amazonOffers(
  results: AmazonResult[],
  isbn13: string,
  title: string,
): Offer[] {
  const offers: Offer[] = [];
  for (const item of results) {
    const { asin, extracted_price: price } = item;
    if (!asin || !price) continue;
    const name = item.title ?? "";
    const exact = asin === isbn10Of(isbn13);
    if (!exact && !listingMatches(name, title)) continue;
    const priceCents = toCents(price);
    if (!plausiblePrice(priceCents)) continue;
    offers.push({
      store: "Amazon",
      format: /kindle|-ebook\b/i.test(`${name} ${item.link_clean ?? ""}`)
        ? "ebook"
        : "print",
      condition: "new",
      priceCents,
      currency: "USD",
      inStock: true,
      url: amazonUrl(asin),
    });
  }
  return cheapestOfEach(offers);
}

export const amazonSearch: Provider = {
  id: "serpapi-amazon",
  store: "Amazon",
  enabled: () => serpApiEnabled() && !keepa.enabled(),

  async fetchOffers(isbn13, signal, book) {
    const data = await searchSerpApi<{
      error?: string;
      organic_results?: AmazonResult[];
    }>({ engine: "amazon", k: isbn13 }, signal);
    return amazonOffers(data.organic_results ?? [], isbn13, book.title);
  },
};
