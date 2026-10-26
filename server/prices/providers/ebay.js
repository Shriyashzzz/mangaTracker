// eBay Browse API: print copies on eBay US, searched by ISBN (a GTIN).
// Needs EBAY_CLIENT_ID + EBAY_CLIENT_SECRET from developer.ebay.com, and
// eBay may need to approve the app for the Buy APIs.
// https://developer.ebay.com/api-docs/buy/browse/resources/item_summary/methods/search
import { ebayAffiliateUrl, ebayCampaignId } from "../affiliates.js";

const TOKEN_URL = "https://api.ebay.com/identity/v1/oauth2/token";
const SEARCH_URL = "https://api.ebay.com/buy/browse/v1/item_summary/search";

// app tokens last about two hours; reuse one until shortly before it expires
let cached = { token: null, expiresAt: 0 };

async function appToken(signal) {
  if (cached.token && Date.now() < cached.expiresAt - 60_000) {
    return cached.token;
  }
  const basic = Buffer.from(
    `${process.env.EBAY_CLIENT_ID}:${process.env.EBAY_CLIENT_SECRET}`,
  ).toString("base64");
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      scope: "https://api.ebay.com/oauth/api_scope",
    }),
    signal,
  });
  if (!res.ok) throw new Error(`eBay token request failed (${res.status})`);
  const data = await res.json();
  cached = {
    token: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };
  return cached.token;
}

const cents = (amount) => Math.round(Number(amount) * 100);

export default {
  id: "ebay",
  store: "eBay",
  enabled: () =>
    Boolean(process.env.EBAY_CLIENT_ID && process.env.EBAY_CLIENT_SECRET),

  async fetchOffers(isbn13, signal) {
    const params = new URLSearchParams({
      gtin: isbn13,
      filter: "buyingOptions:{FIXED_PRICE},deliveryCountry:US",
      sort: "price",
      limit: "20",
    });
    const res = await fetch(`${SEARCH_URL}?${params}`, {
      headers: {
        Authorization: `Bearer ${await appToken(signal)}`,
        "X-EBAY-C-MARKETPLACE-ID": "EBAY_US",
        // asks eBay to include affiliate links in the results
        ...(ebayCampaignId() && {
          "X-EBAY-C-ENDUSERCTX": `affiliateCampaignId=${ebayCampaignId()}`,
        }),
      },
      signal,
    });
    if (!res.ok) throw new Error(`eBay search responded ${res.status}`);
    const { itemSummaries = [] } = await res.json();

    // cheapest new and cheapest used, shipping included
    const best = {};
    for (const item of itemSummaries) {
      if (item.price?.currency !== "USD") continue;
      const condition = item.conditionId === "1000" ? "new" : "used";
      const shipping = cents(
        item.shippingOptions?.[0]?.shippingCost?.value ?? 0,
      );
      const total = cents(item.price.value) + shipping;
      if (!best[condition] || total < best[condition].priceCents) {
        best[condition] = {
          store: this.store,
          format: "print",
          condition,
          priceCents: total,
          currency: "USD",
          inStock: true,
          // with a campaign ID, eBay returns a ready-made affiliate link
          url:
            item.itemAffiliateWebUrl ??
            ebayAffiliateUrl(item.itemWebUrl, "listing"),
        };
      }
    }
    return Object.values(best);
  },
};
