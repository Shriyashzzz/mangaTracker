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
  saysNovel,
  isSingleVolume,
  listingMatches,
  namesOtherVolume,
  NOT_A_BOOK,
  PICK_ONE,
  namesSeries,
  seriesName,
  setHolds,
  setOfBooks,
  isOmnibusBook,
  isOmnibusListing,
  severalBooks,
  saysBoxSet,
  ownSeriesSet,
  withoutSeriesName,
  withoutSeriesWords,
  setSize,
  seriesThenVolume,
  volumeOf,
} from "../stores/match.js";
import { plausiblePrice } from "../stores/retailers.js";

// a volume found by its own ISBN can be out of print, and cost what it does
// now (xxxHOLiC 19 at $91, Parasyte 8 at $298); one matched by title keeps
// the usual ceiling
const plausibleByIsbn = (cents: number) => cents >= 200 && cents <= 50_000;
// eBay works out "calculated" shipping only for one listing at a time, never
// in a search: such a listing gets what a book usually costs to post (USPS
// Media Mail) rather than being left out
const ESTIMATED_SHIPPING = "5.00";

// a box set can cost what many volumes do, but not under $3 a volume: that's
// one volume's price on a listing naming the whole run
const plausibleSetPrice = (cents: number, size: number) =>
  cents >= Math.max(200, size * 300) && cents <= 100_000;
import { isCollection, type Offer, type Provider } from "../types.js";

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
  shippingOptions?: {
    shippingCostType?: string;
    shippingCost?: { value: string; currency?: string };
  }[];
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
  // novels among the results: the series has both formats, so a manga's
  // listing has to say it's manga
  const bothFormats = items.some((i) => saysNovel(i.title ?? ""));
  // a page for an omnibus: omnibus listings are the book itself
  const omnibusPage = isOmnibusBook(title);
  for (const item of items) {
    const name = item.title ?? "";
    const shipping = item.shippingOptions?.[0];
    const shippingValue =
      shipping?.shippingCost?.value ??
      (shipping?.shippingCostType === "CALCULATED"
        ? ESTIMATED_SHIPPING
        : undefined);
    // the listing with the series' own name taken out (see match.ts)
    const bare = withoutSeriesWords(name, title);
    const rest = withoutSeriesName(name, title);
    if (!item.price || item.price.currency !== currency) continue;
    if (shippingValue === undefined || !item.itemWebUrl) continue;
    if (JAPANESE_EDITION.test(name) || /\bimport\b/i.test(name)) continue;
    // "choose from list": one of many books, which one unknown
    if (PICK_ONE.test(bare)) continue;
    // a title search finds the series' merchandise too
    if (by === "title" && NOT_A_BOOK.test(bare)) continue;
    const omnibus = isOmnibusListing(rest);
    // this page's own omnibus: named as one, or found by its ISBN under any
    // name ("One Piece: East Blue 1-2-3") unless it's plainly a box or a lot
    const itself =
      omnibusPage &&
      (omnibus ||
        (by === "isbn" && !isSingleVolume(rest) && !severalBooks(rest)));
    // a box set or an omnibus holding this volume among others
    const set = !itself && (omnibus || !isSingleVolume(rest));
    if (itself) {
      if (
        by === "title" &&
        !(
          namesSeries(name, title) &&
          seriesThenVolume(name, title) &&
          formatFits(name, title, bothFormats)
        )
      )
        continue;
    } else if (set) {
      if (!setHolds(name, title)) continue;
      // a box set has to say it's one: a lot of loose volumes isn't
      if (!omnibus && !saysBoxSet(bare)) continue;
      // and of this series, not a sequel sharing its name (an omnibus often
      // has an arc's name after the series': "One Piece: East Blue 1-2-3")
      if (!omnibus && !ownSeriesSet(name, title)) continue;
      if (
        by === "title" &&
        !(
          namesSeries(name, title) &&
          formatFits(name, title, bothFormats) &&
          setOfBooks(name)
        )
      )
        continue;
    } else if (by === "isbn") {
      if (namesOtherVolume(rest, title)) continue;
    } else if (omnibusPage) {
      // a plain volume's listing isn't the omnibus this page is for
      continue;
    } else if (
      // a single copy from a title search must name this volume's number
      isNaN(volumeOf(title)) ||
      !(
        listingMatches(name, title) &&
        seriesThenVolume(name, title) &&
        formatFits(name, title, bothFormats)
      )
    ) {
      continue;
    }
    const priceCents =
      toCents(Number(item.price.value)) + toCents(Number(shippingValue));
    if (
      set
        ? !plausibleSetPrice(priceCents, setSize(rest))
        : !(by === "isbn" ? plausibleByIsbn : plausiblePrice)(priceCents)
    )
      continue;
    offers.push({
      store,
      format: set ? (omnibus ? "omnibus" : "set") : "print",
      condition: item.conditionId === "1000" ? "new" : "used",
      priceCents,
      currency,
      inStock: true,
      ...(!shipping?.shippingCost && { shippingEstimated: true }),
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

// eBay's Books & Magazines category. A title search runs only there: sorted
// by price, a popular series' first 50 results are otherwise all trading
// cards (One Piece's were)
const BOOKS_CATEGORY = "267";

// one search: fixed-price listings that ship to the market's country,
// cheapest first
async function browse(
  q: string,
  market: EbayMarket,
  signal: AbortSignal,
  category?: string,
): Promise<ItemSummary[]> {
  const { id, country } = MARKETS[market];
  const params = new URLSearchParams({
    q,
    ...(category && { category_ids: category }),
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
    queries.volume
      ? browse(queries.volume, market, signal, BOOKS_CATEGORY)
      : [],
    browse(queries.sets, market, signal, BOOKS_CATEGORY),
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
  const singles = isbnOffers.filter((o) => !isCollection(o));
  return cheapestOfEach([
    ...(singles.length ? singles : titleOffers.filter((o) => !isCollection(o))),
    ...isbnOffers.filter(isCollection),
    ...titleOffers.filter(isCollection),
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
