// eBay Browse API: print copies on eBay US and eBay Canada, searched by ISBN
// (a GTIN). Free, unlike searching eBay through SerpApi, so when it's set up
// it replaces those searches in both countries. Needs EBAY_CLIENT_ID +
// EBAY_CLIENT_SECRET (a production keyset) from developer.ebay.com.
// https://developer.ebay.com/api-docs/buy/browse/resources/item_summary/methods/search
import config from "../../config/config.js";
import { cheapestOfEach, toCents } from "../offerHelpers.js";
import { ebayAffiliateUrl, ebayCampaignId } from "../stores/affiliates.js";
import {
  JAPANESE_EDITION,
  isSingleVolume,
  namesOtherVolume,
} from "../stores/match.js";
import { plausiblePrice } from "../stores/retailers.js";
import type { Offer, Provider } from "../types.js";

const TOKEN_URL = "https://api.ebay.com/identity/v1/oauth2/token";
const SEARCH_URL = "https://api.ebay.com/buy/browse/v1/item_summary/search";

export const ebayApiEnabled = () =>
  Boolean(config.EBAY_CLIENT_ID && config.EBAY_CLIENT_SECRET);

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
  const data = (await res.json()) as {
    access_token: string;
    expires_in: number;
  };
  cached = {
    token: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };
  return data.access_token;
}

export type ItemSummary = {
  title?: string;
  conditionId?: string;
  price?: { value: string; currency: string };
  shippingOptions?: { shippingCost?: { value: string; currency?: string } }[];
  itemWebUrl?: string;
  itemAffiliateWebUrl?: string;
};

const MARKETS = {
  US: { id: "EBAY_US", currency: "USD", store: "eBay", country: "US" },
  CA: { id: "EBAY_CA", currency: "CAD", store: "eBay.ca", country: "CA" },
} as const;
export type EbayMarket = keyof typeof MARKETS;

// The same rules as eBay through SerpApi: the search is by ISBN, so only what
// the title says is something else is dropped (sets, other volumes, Japanese
// editions, imports), plus prices too odd to be one paperback. The price
// includes shipping; a listing with no shipping price (calculated at checkout,
// or pickup only) is left out, since its real cost isn't known
export function browseOffers(
  items: ItemSummary[],
  title: string,
  market: EbayMarket,
): Offer[] {
  const { currency, store } = MARKETS[market];
  const offers: Offer[] = [];
  for (const item of items) {
    const name = item.title ?? "";
    const shippingValue = item.shippingOptions?.[0]?.shippingCost?.value;
    if (!item.price || item.price.currency !== currency) continue;
    if (shippingValue === undefined || !item.itemWebUrl) continue;
    if (!isSingleVolume(name) || namesOtherVolume(name, title)) continue;
    if (JAPANESE_EDITION.test(name) || /\bimport\b/i.test(name)) continue;
    const priceCents =
      toCents(Number(item.price.value)) + toCents(Number(shippingValue));
    if (!plausiblePrice(priceCents)) continue;
    offers.push({
      store,
      format: "print",
      condition: item.conditionId === "1000" ? "new" : "used",
      priceCents,
      currency,
      inStock: true,
      // US links carry eBay US tracking here; Canadian ones get eBay Canada's
      // where they're shown (prices/canada)
      url:
        market === "US"
          ? (item.itemAffiliateWebUrl ??
            ebayAffiliateUrl(item.itemWebUrl, "listing"))
          : item.itemWebUrl,
    });
  }
  return cheapestOfEach(offers);
}

// fixed-price listings that ship to the market's country, cheapest first
export async function searchEbay(
  isbn13: string,
  title: string,
  market: EbayMarket,
  signal: AbortSignal,
): Promise<Offer[]> {
  const { id, country } = MARKETS[market];
  const params = new URLSearchParams({
    gtin: isbn13,
    filter: `buyingOptions:{FIXED_PRICE},deliveryCountry:${country}${
      market === "US" ? ",itemLocationCountry:US" : ""
    }`,
    sort: "price",
    limit: "50",
  });
  const campaignId = ebayCampaignId();
  const res = await fetch(`${SEARCH_URL}?${params}`, {
    headers: {
      Authorization: `Bearer ${await appToken(signal)}`,
      "X-EBAY-C-MARKETPLACE-ID": id,
      // asks eBay to include affiliate links in US results
      ...(campaignId &&
        market === "US" && {
          "X-EBAY-C-ENDUSERCTX": `affiliateCampaignId=${campaignId}`,
        }),
    },
    signal,
  });
  if (!res.ok) throw new Error(`eBay search responded ${res.status}`);
  const { itemSummaries = [] } = (await res.json()) as {
    itemSummaries?: ItemSummary[];
  };
  return browseOffers(itemSummaries, title, market);
}

const ebay: Provider = {
  id: "ebay",
  store: "eBay",
  enabled: ebayApiEnabled,
  fetchOffers: (isbn13, signal, book) =>
    searchEbay(isbn13, book.title, "US", signal),
};

export default ebay;
