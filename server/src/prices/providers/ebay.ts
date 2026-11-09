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
  FOREIGN_EDITION,
  REBOUND,
  fitsOmnibusPage,
  normalize,
  otherEdition,
  editionsOf,
  formatFits,
  isNovelBook,
  saysNovel,
  isSingleVolume,
  namesOtherVolume,
  NOT_A_BOOK,
  PICK_ONE,
  namesSeries,
  searchName,
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

// a used copy found by its own ISBN can be out of print, and cost what it
// does now (xxxHOLiC 19 at $91, Parasyte 8 at $298). A new one, or one
// matched by title, keeps the usual ceiling: a "new" copy far above it is a
// collector's edition or a mistake, not this paperback
const plausibleUsedByIsbn = (cents: number) => cents >= 200 && cents <= 50_000;

// a distributor's code ("(C: 1-0-0)") and an ISBN written with dashes read
// like volume numbers: they go before a title is read
const cleanTitle = (title: string) =>
  title
    .replace(/\(\s*c\s*:\s*[\d-]+\s*\)/gi, " ")
    .replace(/\b97[89][\d-]{10,14}\b/g, " ");

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
  // a page for an omnibus: omnibus listings are the book itself
  const omnibusPage = isOmnibusBook(title);
  // the title as matching reads it: a Kodansha omnibus ("Attack on Titan
  // Omnibus 9 (Vol. 25-27)") goes by its own number, not the volumes it holds
  const matchTitle = omnibusPage ? omnibusTitle(title) : title;
  // a novel of this very volume among the results: the series has both
  // formats, so a manga's listing has to say it's manga. Junk that happens
  // to say "novels" ("Assorted Anime Manga/Novels") doesn't count
  const bothFormats = items.some((i) => {
    const t = i.title ?? "";
    return saysNovel(t) && seriesThenVolume(t, matchTitle);
  });
  for (const item of items) {
    const name = cleanTitle(item.title ?? "");
    // a listing with "calculated" shipping has no shipping price in a search
    // (eBay works it out per buyer), so its real cost isn't known: left out
    const shippingValue = item.shippingOptions?.[0]?.shippingCost?.value;
    // the listing with the series' own name taken out (see match.ts)
    const bare = withoutSeriesWords(name, title);
    const rest = withoutSeriesName(name, title);
    if (!item.price || item.price.currency !== currency) continue;
    if (shippingValue === undefined || !item.itemWebUrl) continue;
    if (JAPANESE_EDITION.test(name) || /\bimport\b/i.test(name)) continue;
    // another language's edition, or a third party's rebinding
    if (FOREIGN_EDITION.test(bare) || REBOUND.test(normalize(name))) continue;
    // "choose from list": one of many books, which one unknown
    if (PICK_ONE.test(bare)) continue;
    // a title search finds the series' merchandise too
    if (by === "title" && NOT_A_BOOK.test(bare)) continue;
    const omnibus = isOmnibusListing(rest);
    // this page's own omnibus: named as one, or found by its ISBN under any
    // name ("One Piece: East Blue 1-2-3") unless it's plainly a box or a lot
    const itself =
      omnibusPage &&
      fitsOmnibusPage(rest, title) &&
      (omnibus ||
        (by === "isbn" && !isSingleVolume(rest) && !severalBooks(rest)));
    // a box set or an omnibus holding this volume among others
    const set = !itself && (omnibus || !isSingleVolume(rest));
    if (itself) {
      if (
        by === "title" &&
        !(
          namesSeries(name, matchTitle) &&
          seriesThenVolume(name, matchTitle) &&
          // an edition named on the page has to match; a page that's an
          // omnibus by its contents ("One Piece, Vol. 1 (Romance Dawn / …)")
          // names none
          (editionsOf(title).size === 0 || !otherEdition(name, title)) &&
          formatFits(name, title, bothFormats)
        )
      )
        continue;
    } else if (set) {
      if (!setHolds(name, title)) continue;
      // a box set has to say it's one: a lot of loose volumes isn't
      if (!omnibus && !saysBoxSet(bare, rest)) continue;
      // and of this series, not a sequel sharing its name (an omnibus often
      // has an arc's name after the series': "One Piece: East Blue 1-2-3")
      if (!omnibus && !ownSeriesSet(name, title)) continue;
      if (
        by === "title" &&
        !(
          namesSeries(name, title) &&
          // a manga's box set rarely says "manga"; it only mustn't say novel
          formatFits(name, title, false) &&
          setOfBooks(name)
        )
      )
        continue;
    } else if (by === "isbn") {
      if (namesOtherVolume(rest, matchTitle)) continue;
    } else if (omnibusPage) {
      // a plain volume's listing isn't the omnibus this page is for
      continue;
    } else if (
      // a single copy from a title search must name this volume's number
      isNaN(volumeOf(title)) ||
      namesOtherVolume(rest, title) ||
      !(
        seriesThenVolume(name, title) &&
        !otherEdition(name, title) &&
        formatFits(name, title, bothFormats)
      )
    ) {
      continue;
    }
    const priceCents =
      toCents(Number(item.price.value)) + toCents(Number(shippingValue));
    const condition = item.conditionId === "1000" ? "new" : "used";
    if (
      set
        ? !plausibleSetPrice(priceCents, setSize(rest))
        : !(
            by === "isbn" && condition === "used"
              ? plausibleUsedByIsbn
              : plausiblePrice
          )(priceCents)
    )
      continue;
    offers.push({
      store,
      format: set ? (omnibus ? "omnibus" : "set") : "print",
      condition,
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
// "Attack on Titan Omnibus 9 (Vol. 25-27)" as matched and searched for:
// "Attack on Titan Omnibus 9"
export const omnibusTitle = (title: string) =>
  title.replace(/\s*\((?:vols?|volumes?)\.?\s*[\d\s,&–-]+\)\s*$/i, "");

export function titleQueries(bookTitle: string) {
  const title = isOmnibusBook(bookTitle) ? omnibusTitle(bookTitle) : bookTitle;
  const series = searchName(title).replace(/\s*light novel$/i, "");
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
// alongside: its single copies fill in a condition (new, used) the ISBN
// search found none of, while box sets holding this volume are taken from
// every search. Free, so three searches at once cost nothing; a failed title
// search leaves the ISBN's
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
  const has = new Set(singles.map((o) => o.condition));
  return cheapestOfEach([
    ...singles,
    ...titleOffers.filter((o) => !isCollection(o) && !has.has(o.condition)),
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
