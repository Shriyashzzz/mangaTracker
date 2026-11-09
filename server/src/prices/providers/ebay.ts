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
  formatFits,
  isNovelBook,
  isSingleVolume,
  listingMatches,
  namesOtherVolume,
  NOT_A_BOOK,
  namesSeries,
  seriesName,
  setHolds,
  setOfBooks,
  setSize,
  seriesThenVolume,
  volumeOf,
} from "../stores/match.js";
import { plausiblePrice } from "../stores/retailers.js";

// a box set can cost what many volumes do, but not under $3 a volume: that's
// one volume's price on a listing naming the whole run
const plausibleSetPrice = (cents: number, size: number) =>
  cents >= Math.max(200, size * 300) && cents <= 100_000;
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

// How a search was made decides how much a title must prove:
// - "isbn": the ISBN as a keyword, so the listing holds it. Only a title
//   saying it's something else is dropped (another volume, a Japanese
//   edition, an import)
// - "title": the series and volume number, for listings nobody tagged with
//   the ISBN. The series words and the volume number must be there, and the
//   format too: a light novel's listing says it's a novel, a manga's doesn't
// Either way, a box set (or a run of volumes) holding this volume is kept as
// format "set": shown and labelled, never counted as this volume's price.
// Prices include shipping; a listing with no shipping price (calculated at
// checkout, or pickup only) is left out, since its real cost isn't known
export function browseOffers(
  items: ItemSummary[],
  title: string,
  market: EbayMarket,
  by: "isbn" | "title" = "isbn",
): Offer[] {
  const { currency, store } = MARKETS[market];
  const offers: Offer[] = [];
  for (const item of items) {
    const name = item.title ?? "";
    const shippingValue = item.shippingOptions?.[0]?.shippingCost?.value;
    if (!item.price || item.price.currency !== currency) continue;
    if (shippingValue === undefined || !item.itemWebUrl) continue;
    if (JAPANESE_EDITION.test(name) || /\bimport\b/i.test(name)) continue;
    // a title search finds the series' merchandise too
    if (by === "title" && NOT_A_BOOK.test(name)) continue;
    const set = !isSingleVolume(name);
    if (set) {
      if (!setHolds(name, title)) continue;
      if (
        by === "title" &&
        !(
          namesSeries(name, title) &&
          formatFits(name, title) &&
          setOfBooks(name)
        )
      )
        continue;
    } else if (by === "isbn") {
      if (namesOtherVolume(name, title)) continue;
    } else if (
      // a single copy from a title search must name this volume's number
      isNaN(volumeOf(title)) ||
      !(
        listingMatches(name, title) &&
        seriesThenVolume(name, title) &&
        formatFits(name, title)
      )
    ) {
      continue;
    }
    const priceCents =
      toCents(Number(item.price.value)) + toCents(Number(shippingValue));
    if (
      set
        ? !plausibleSetPrice(priceCents, setSize(name))
        : !plausiblePrice(priceCents)
    )
      continue;
    offers.push({
      store,
      format: set ? "set" : "print",
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

// what a title search asks for: the series, "light novel" for a novel, and
// the volume number ("Overlord light novel vol 16"), or "box set" for sets.
// null when the volume has no number to search by
export function titleQueries(title: string) {
  const series = seriesName(title).replace(/\s*light novel$/i, "");
  const kind = isNovelBook(title) ? " light novel" : "";
  const n = volumeOf(title);
  return {
    volume: isNaN(n) ? null : `${series}${kind} vol ${n}`,
    sets: `${series}${kind} box set`,
  };
}

// one search: fixed-price listings that ship to the market's country,
// cheapest first
async function browse(
  q: string,
  market: EbayMarket,
  signal: AbortSignal,
): Promise<ItemSummary[]> {
  const { id, country } = MARKETS[market];
  const params = new URLSearchParams({
    q,
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
  return itemSummaries;
}

// The ISBN as a keyword finds more than eBay's own ISBN (GTIN) filter, which
// only matches listings tagged with it. Many aren't, so a title search runs
// alongside: its single copies count only when the ISBN found none, while
// box sets holding this volume are taken from every search. Free, so three
// searches at once cost nothing; a failed title search leaves the ISBN's
export async function searchEbay(
  isbn13: string,
  title: string,
  market: EbayMarket,
  signal: AbortSignal,
): Promise<Offer[]> {
  const queries = titleQueries(title);
  const [byIsbn, byTitle, sets] = await Promise.allSettled([
    browse(isbn13, market, signal),
    queries.volume ? browse(queries.volume, market, signal) : [],
    browse(queries.sets, market, signal),
  ]);
  // the ISBN search is the one that must answer
  if (byIsbn.status === "rejected") throw byIsbn.reason;
  const found = (r: PromiseSettledResult<ItemSummary[]>) =>
    r.status === "fulfilled" ? r.value : [];
  const isbnOffers = browseOffers(byIsbn.value, title, market, "isbn");
  const titleOffers = browseOffers(
    [...found(byTitle), ...found(sets)],
    title,
    market,
    "title",
  );
  const singles = isbnOffers.filter((o) => o.format !== "set");
  return cheapestOfEach([
    ...(singles.length
      ? singles
      : titleOffers.filter((o) => o.format !== "set")),
    ...isbnOffers.filter((o) => o.format === "set"),
    ...titleOffers.filter((o) => o.format === "set"),
  ]);
}

const ebay: Provider = {
  id: "ebay",
  store: "eBay",
  enabled: ebayApiEnabled,
  fetchOffers: (isbn13, signal, book) =>
    searchEbay(isbn13, book.title, "US", signal),
};

export default ebay;
