// Reading SerpApi's Canadian results into offers, in Canadian dollars. Only uses
// the shared title-matching rules; nothing here changes how US prices work.
import {
  JAPANESE_EDITION,
  isSingleVolume,
  listingMatches,
  namesOtherVolume,
} from "../stores/match.js";
import {
  dropUnlikelyNew,
  isNotABook,
  isResaleSite,
  plausiblePrice,
} from "../stores/retailers.js";
import type { Offer } from "../types.js";
import {
  DIGITAL,
  USED,
  cheapestOfEach,
  shippingCents,
  toCents,
} from "../offerHelpers.js";

export type CaShoppingResult = {
  title?: string;
  source?: string;
  snippet?: string;
  extensions?: string[];
  extracted_price?: number;
  product_link?: string;
};

export type CaEbayResult = {
  title?: string;
  link?: string;
  product_id?: string;
  condition?: string;
  shipping?: string | { extracted?: number };
  price?: { extracted?: number; from?: unknown };
};

// Google Shopping, Canada: Amazon.ca, Indigo, World of Books and the rest
export function shoppingOffers(
  results: CaShoppingResult[],
  title: string,
): Offer[] {
  const offers: Offer[] = [];
  for (const item of results) {
    if (!item.source || !(item.extracted_price && item.extracted_price > 0))
      continue;
    const name = item.title ?? "";
    if (!listingMatches(name, title)) continue;
    const text = [name, item.snippet, ...(item.extensions ?? [])].join(" ");
    if (JAPANESE_EDITION.test(`${text} ${item.source}`)) continue;
    if (!isSingleVolume(name) || namesOtherVolume(name, title)) continue;
    if (isNotABook(item.source)) continue;
    const priceCents = toCents(item.extracted_price);
    if (!plausiblePrice(priceCents)) continue;
    offers.push({
      store: item.source.replace(/^Amazon CA$/i, "Amazon.ca").slice(0, 60),
      format: DIGITAL.test(item.source) ? "ebook" : "print",
      condition: isResaleSite(item.source)
        ? "marketplace"
        : USED.test(text)
          ? "used"
          : "new",
      priceCents,
      currency: "CAD",
      inStock: true,
      url: item.product_link ?? null,
    });
  }
  return cheapestOfEach(offers);
}

// eBay.ca by ISBN: anything that ships to Canada, priced with shipping
export function ebayCaOffers(results: CaEbayResult[], title: string): Offer[] {
  const offers: Offer[] = [];
  for (const item of results) {
    const name = item.title ?? "";
    const price = item.price?.extracted;
    const shipping = shippingCents(item.shipping);
    const url = item.product_id
      ? `https://www.ebay.ca/itm/${item.product_id}`
      : (item.link ?? null);
    if (!price || item.price?.from || shipping === null || !url) continue;
    if (!isSingleVolume(name) || namesOtherVolume(name, title)) continue;
    if (JAPANESE_EDITION.test(name) || /\bimport\b/i.test(name)) continue;
    const priceCents = toCents(price) + shipping;
    if (!plausiblePrice(priceCents)) continue;
    offers.push({
      store: "eBay.ca",
      format: "print",
      condition: /^brand new/i.test(item.condition ?? "") ? "new" : "used",
      priceCents,
      currency: "CAD",
      inStock: true,
      url,
    });
  }
  return cheapestOfEach(offers);
}

// both sources together, without new copies we don't believe, cheapest first
export const believableOffers = (offers: Offer[], usualCents?: number | null) =>
  dropUnlikelyNew(offers, usualCents).sort(
    (a, b) => a.priceCents - b.priceCents,
  );
