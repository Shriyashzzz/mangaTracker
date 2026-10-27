// Keepa: Amazon US prices (Amazon itself plus marketplace sellers), looked up
// by ISBN. Paid: needs KEEPA_API_KEY from keepa.com/#!api, and every lookup
// spends tokens from your plan. Untested against a live account yet.
// https://keepa.com/#!discuss/t/product-object/116
import config from "../../config/config.js";
import { amazonTag } from "../affiliates.js";
import type { Offer, Provider } from "../types.js";

const URL = "https://api.keepa.com/product";

// positions in Keepa's stats.current array, prices in cents, -1 = none
const AMAZON = 0;
const NEW_3RD_PARTY = 1;
const USED = 2;

const productUrl = (asin: string) => {
  const tag = amazonTag();
  return `https://www.amazon.com/dp/${asin}${tag ? `?tag=${encodeURIComponent(tag)}` : ""}`;
};

const keepa: Provider = {
  id: "keepa",
  store: "Amazon",
  enabled: () => Boolean(config.KEEPA_API_KEY),

  async fetchOffers(isbn13, signal) {
    const params = new URLSearchParams({
      key: config.KEEPA_API_KEY!,
      domain: "1", // amazon.com
      code: isbn13,
      stats: "1",
    });
    const res = await fetch(`${URL}?${params}`, { signal });
    if (!res.ok) throw new Error(`Keepa responded ${res.status}`);
    const { products = [] } = (await res.json()) as {
      products?: { asin: string; stats?: { current?: number[] } }[];
    };
    const product = products[0];
    const current = product?.stats?.current;
    if (!product || !current) return [];

    const url = productUrl(product.asin);
    // the cheapest of Amazon's own price and third-party new copies
    const newCents = [current[AMAZON], current[NEW_3RD_PARTY]]
      .filter((c): c is number => c !== undefined && c > 0)
      .sort((a, b) => a - b)[0];
    const used = current[USED];

    const offers: Offer[] = [];
    const base = { store: this.store, format: "print", currency: "USD", inStock: true, url };
    if (newCents) offers.push({ ...base, condition: "new", priceCents: newCents });
    if (used && used > 0) offers.push({ ...base, condition: "used", priceCents: used });
    return offers;
  },
};

export default keepa;
