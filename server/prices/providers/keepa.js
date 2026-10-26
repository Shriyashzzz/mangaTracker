import { amazonAffiliate } from "../storeLinks.js";

// Keepa: Amazon US prices (Amazon itself plus marketplace sellers), looked up
// by ISBN. Paid: needs KEEPA_API_KEY from keepa.com/#!api, and every lookup
// spends tokens from your plan. Untested against a live account yet.
// https://keepa.com/#!discuss/t/product-object/116
const URL = "https://api.keepa.com/product";

// positions in Keepa's stats.current array, prices in cents, -1 = none
const AMAZON = 0;
const NEW_3RD_PARTY = 1;
const USED = 2;

const productUrl = (asin) => {
  const tag = process.env.AMAZON_ASSOCIATE_TAG?.trim();
  return `https://www.amazon.com/dp/${asin}${amazonAffiliate() ? `?tag=${encodeURIComponent(tag)}` : ""}`;
};

export default {
  id: "keepa",
  store: "Amazon",
  enabled: () => Boolean(process.env.KEEPA_API_KEY),

  async fetchOffers(isbn13, signal) {
    const params = new URLSearchParams({
      key: process.env.KEEPA_API_KEY,
      domain: "1", // amazon.com
      code: isbn13,
      stats: "1",
    });
    const res = await fetch(`${URL}?${params}`, { signal });
    if (!res.ok) throw new Error(`Keepa responded ${res.status}`);
    const { products = [] } = await res.json();
    const product = products[0];
    const current = product?.stats?.current;
    if (!current) return [];

    const url = productUrl(product.asin);
    // Amazon's own price wins over third-party new copies when both exist
    const newCents = [current[AMAZON], current[NEW_3RD_PARTY]]
      .filter((c) => c > 0)
      .sort((a, b) => a - b)[0];

    const offers = [];
    if (newCents) {
      offers.push({
        store: this.store,
        format: "print",
        condition: "new",
        priceCents: newCents,
        currency: "USD",
        inStock: true,
        url,
      });
    }
    if (current[USED] > 0) {
      offers.push({
        store: this.store,
        format: "print",
        condition: "used",
        priceCents: current[USED],
        currency: "USD",
        inStock: true,
        url,
      });
    }
    return offers;
  },
};
