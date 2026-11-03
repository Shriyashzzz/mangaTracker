// What the US and Canadian price searches share for reading SerpApi results,
// kept in one place so a fix reaches both
import type { Offer } from "./types.js";

export const USED = /\b(used|pre-?owned|refurbished|second-?hand)\b/i;

// digital storefronts: their "price" is an ebook
export const DIGITAL =
  /\b(bookwalker|kindle|kobo|comixology|google play|apple books|nook)\b/i;

export const toCents = (dollars: number) => Math.round(dollars * 100);

// the cheapest offer for each store + format + condition
export const cheapestOfEach = (offers: Offer[]) => {
  const best = new Map<string, Offer>();
  for (const o of offers) {
    const key = `${o.store}|${o.format}|${o.condition}`;
    const current = best.get(key);
    if (!current || o.priceCents < current.priceCents) best.set(key, o);
  }
  return [...best.values()];
};

// eBay's shipping: a number, "Free shipping", or unknown (null)
export const shippingCents = (
  shipping: string | { extracted?: number } | undefined,
) => {
  if (typeof shipping === "object") {
    return shipping.extracted === undefined ? null : toCents(shipping.extracted);
  }
  return /free/i.test(shipping ?? "") ? 0 : null;
};
