// eBay Browse API: print copies on eBay US, searched by ISBN (a GTIN).
// Needs EBAY_CLIENT_ID + EBAY_CLIENT_SECRET from developer.ebay.com, and
// eBay may need to approve the app for the Buy APIs. Untested live.
// https://developer.ebay.com/api-docs/buy/browse/resources/item_summary/methods/search
import config from "../../config/config.js";
import { ebayAffiliateUrl, ebayCampaignId } from "../affiliates.js";
import type { Offer, Provider } from "../types.js";

const TOKEN_URL = "https://api.ebay.com/identity/v1/oauth2/token";
const SEARCH_URL = "https://api.ebay.com/buy/browse/v1/item_summary/search";

// app tokens last about two hours; reuse one until shortly before it expires
let cached: { token: string | null; expiresAt: number } = {
  token: null,
  expiresAt: 0,
};

async function appToken(signal: AbortSignal) {
  if (cached.token && Date.now() < cached.expiresAt - 60_000) {
    return cached.token;
  }
  const basic = Buffer.from(
    `${config.EBAY_CLIENT_ID}:${config.EBAY_CLIENT_SECRET}`,
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
  const data = (await res.json()) as { access_token: string; expires_in: number };
  cached = {
    token: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };
  return data.access_token;
}

const cents = (amount: string | number) => Math.round(Number(amount) * 100);

type ItemSummary = {
  conditionId?: string;
  price?: { value: string; currency: string };
  shippingOptions?: { shippingCost?: { value: string } }[];
  itemWebUrl?: string;
  itemAffiliateWebUrl?: string;
};

const ebay: Provider = {
  id: "ebay",
  store: "eBay",
  enabled: () => Boolean(config.EBAY_CLIENT_ID && config.EBAY_CLIENT_SECRET),

  async fetchOffers(isbn13, signal) {
    const params = new URLSearchParams({
      gtin: isbn13,
      filter: "buyingOptions:{FIXED_PRICE},deliveryCountry:US",
      sort: "price",
      limit: "20",
    });
    const campaignId = ebayCampaignId();
    const res = await fetch(`${SEARCH_URL}?${params}`, {
      headers: {
        Authorization: `Bearer ${await appToken(signal)}`,
        "X-EBAY-C-MARKETPLACE-ID": "EBAY_US",
        // asks eBay to include affiliate links in the results
        ...(campaignId && {
          "X-EBAY-C-ENDUSERCTX": `affiliateCampaignId=${campaignId}`,
        }),
      },
      signal,
    });
    if (!res.ok) throw new Error(`eBay search responded ${res.status}`);
    const { itemSummaries = [] } = (await res.json()) as {
      itemSummaries?: ItemSummary[];
    };

    // cheapest new and cheapest used, shipping included
    const best: Record<string, Offer> = {};
    for (const item of itemSummaries) {
      if (!item.price || item.price.currency !== "USD") continue;
      const condition = item.conditionId === "1000" ? "new" : "used";
      const shipping = cents(item.shippingOptions?.[0]?.shippingCost?.value ?? 0);
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
            ebayAffiliateUrl(item.itemWebUrl ?? null, "listing"),
        };
      }
    }
    return Object.values(best);
  },
};

export default ebay;
