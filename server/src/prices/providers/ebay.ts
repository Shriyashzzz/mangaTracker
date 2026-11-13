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
import priceQueries from "../../models/priceQueries.js";
import { SearchesUsedUp } from "./serpapiKeys.js";

// eBay's Browse API allows so many calls a day. Each search takes one from
// today's count first (api_usage, a row per day); none left, it throws
// SearchesUsedUp and the checker keeps the stored prices. The two title
// searches stop at 80%, leaving the rest for ISBN searches, the ones that
// matter most. A 429 from eBay is checked against eBay's own count: the
// day is closed only when its daily allowance is really gone
// eBay's day turns over at midnight Pacific (its rate-limit API says so).
// The row's month is that day's too, not the database clock's (in UTC the
// month turns over hours earlier, which would restart the count mid-day)
const pacificDay = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Los_Angeles",
});
const today = (at = new Date()) => pacificDay.format(at);
export const budgetLabel = (day = today()) => `ebay:${day}`;
const monthOf = (day: string) => `${day.slice(0, 7)}-01`;
const dailyLimit = () => config.EBAY_DAILY_LIMIT;
const titleLimit = () => Math.floor(config.EBAY_DAILY_LIMIT * 0.8);
export const ebayCallsLeft = () => {
  const day = today();
  return priceQueries.anyCallsLeft(
    [budgetLabel(day)],
    dailyLimit(),
    monthOf(day),
  );
};
const markDayUsed = (day: string, calls: number) =>
  priceQueries.markApiSpent(budgetLabel(day), calls, monthOf(day));

// Every place using these keys (the site, a laptop testing) spends the same
// allowance, and each counts only its own calls. So now and then (every 15
// minutes at most) eBay's own count is read and ours raised to it. Free;
// if it can't be read, our own count goes on alone
const RATE_URL =
  "https://api.ebay.com/developer/analytics/v1_beta/rate_limit/?api_context=buy&api_name=browse";
const SYNC_EVERY_MS = 15 * 60_000;
let syncedAt = 0;
// the check under way, which every search starting meanwhile waits for
let syncing: Promise<boolean> = Promise.resolve(true);
export const resetEbaySync = () => {
  syncedAt = 0;
};
type RateLimits = {
  rateLimits?: {
    resources?: {
      name?: string;
      rates?: { count?: number; reset?: string; timeWindow?: number }[];
    }[];
  }[];
};
function syncWithEbay(signal: AbortSignal, now = false) {
  if (now || Date.now() - syncedAt >= SYNC_EVERY_MS) {
    syncedAt = Date.now();
    syncing = readEbayCount(signal);
  }
  return syncing;
}
// eBay's count of the daily window (eBay also has short ones), put on the
// day that window belongs to: the one ending at its `reset`. A count read
// just after our midnight but before eBay's window turned over is the old
// day's, and mustn't close the new one. Whether it could be read
async function readEbayCount(signal: AbortSignal): Promise<boolean> {
  try {
    const res = await fetch(RATE_URL, {
      headers: { Authorization: `Bearer ${await appToken(signal)}` },
      signal,
    });
    if (!res.ok) return false;
    const { rateLimits = [] } = (await res.json()) as RateLimits;
    const daily = rateLimits
      .flatMap((api) => api.resources ?? [])
      .find((r) => r.name === "buy.browse")
      ?.rates?.find((r) => r.timeWindow === 86_400);
    if (typeof daily?.count !== "number") return false;
    const resetAt = daily.reset ? Date.parse(daily.reset) : NaN;
    // the window's own day: half a day before it resets
    const day = isNaN(resetAt)
      ? today()
      : today(new Date(resetAt - 43_200_000));
    if (day === today()) await markDayUsed(day, daily.count);
    return true;
  } catch {
    // unreadable: our own count goes on
    return false;
  }
}

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
type EbayMarket = keyof typeof MARKETS;

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
// what a search was for, as its listings are judged
type Asked = {
  // the volume's title, as its page has it
  title: string;
  // the title as matching reads it: a Kodansha omnibus ("Attack on Titan
  // Omnibus 9 (Vol. 25-27)") goes by its own number, not the volumes it holds
  matchTitle: string;
  by: "isbn" | "title";
  // a page for an omnibus: omnibus listings are the book itself
  omnibusPage: boolean;
  // a novel of this very volume is among the results: the series has both
  // formats, so a manga's listing has to say it's manga
  bothFormats: boolean;
};

// a listing as it's read: its tidied title, and the title with the series'
// own name taken out two ways (see match.ts)
type Listing = { name: string; bare: string; rest: string };

// a listing that can't be an offer for this book, whatever it holds: another
// language's edition, an import, a third party's rebinding, one of many books
// to pick from, or (from a title search) the series' merchandise
function isNotThisBook({ name, bare }: Listing, by: Asked["by"]) {
  if (JAPANESE_EDITION.test(name) || /\bimport\b/i.test(name)) return true;
  if (FOREIGN_EDITION.test(bare) || REBOUND.test(normalize(name))) return true;
  // "choose from list": one of many books, which one unknown
  if (PICK_ONE.test(bare)) return true;
  return by === "title" && NOT_A_BOOK.test(bare);
}

// the page's own omnibus. Found by its ISBN it needs no more proof; from a
// title search it has to name the series, this number, the page's edition
// when it names one, and the right format
function ownOmnibusFits({ name }: Listing, asked: Asked) {
  if (asked.by !== "title") return true;
  // a page that's an omnibus by its contents ("One Piece, Vol. 1 (Romance
  // Dawn / …)") names no edition
  const editionMatches =
    editionsOf(asked.title).size === 0 || !otherEdition(name, asked.title);
  return (
    namesSeries(name, asked.matchTitle) &&
    seriesThenVolume(name, asked.matchTitle) &&
    editionMatches &&
    formatFits(name, asked.title, asked.bothFormats)
  );
}

// a box set, or an omnibus, holding this volume among others
function setFits(
  { name, bare, rest }: Listing,
  isOmnibus: boolean,
  asked: Asked,
) {
  const { title } = asked;
  if (!setHolds(name, title)) return false;
  // a box set has to say it's one: a lot of loose volumes isn't
  if (!isOmnibus && !saysBoxSet(bare, rest)) return false;
  // and of this series, not a sequel sharing its name (an omnibus often has
  // an arc's name after the series': "One Piece: East Blue 1-2-3")
  if (!isOmnibus && !ownSeriesSet(name, title)) return false;
  if (asked.by !== "title") return true;
  // a manga's box set rarely says "manga"; it only mustn't say novel
  return (
    namesSeries(name, title) &&
    formatFits(name, title, false) &&
    setOfBooks(name)
  );
}

// one copy of this volume
function singleFits({ name, rest }: Listing, asked: Asked) {
  const { title } = asked;
  // found by the ISBN: only a title naming another volume is dropped
  if (asked.by === "isbn") return !namesOtherVolume(rest, asked.matchTitle);
  // a plain volume's listing isn't the omnibus this page is for
  if (asked.omnibusPage) return false;
  // a single copy from a title search must name this volume's number
  if (isNaN(volumeOf(title))) return false;
  if (namesOtherVolume(rest, title)) return false;
  return (
    seriesThenVolume(name, title) &&
    !otherEdition(name, title) &&
    formatFits(name, title, asked.bothFormats)
  );
}

// a price a copy like this could really go for
function priceIsPlausible(
  priceCents: number,
  condition: "new" | "used",
  isSet: boolean,
  rest: string,
  by: Asked["by"],
) {
  if (isSet) return plausibleSetPrice(priceCents, setSize(rest));
  if (by === "isbn" && condition === "used")
    return plausibleUsedByIsbn(priceCents);
  return plausiblePrice(priceCents);
}

export function browseOffers(
  items: ItemSummary[],
  title: string,
  market: EbayMarket,
  by: "isbn" | "title" = "isbn",
): Offer[] {
  const { currency, store } = MARKETS[market];
  const omnibusPage = isOmnibusBook(title);
  const matchTitle = omnibusPage ? omnibusTitle(title) : title;
  // junk that happens to say "novels" ("Assorted Anime Manga/Novels")
  // doesn't count: the listing has to be of this series and volume
  const bothFormats = items.some((item) => {
    const itemTitle = item.title ?? "";
    return saysNovel(itemTitle) && seriesThenVolume(itemTitle, matchTitle);
  });
  const asked: Asked = { title, matchTitle, by, omnibusPage, bothFormats };

  const offers: Offer[] = [];
  for (const item of items) {
    const name = cleanTitle(item.title ?? "");
    const listing: Listing = {
      name,
      bare: withoutSeriesWords(name, title),
      rest: withoutSeriesName(name, title),
    };
    const { rest } = listing;
    // a listing with "calculated" shipping has no shipping price in a search
    // (eBay works it out per buyer), so its real cost isn't known: left out
    const shippingValue = item.shippingOptions?.[0]?.shippingCost?.value;
    if (!item.price || item.price.currency !== currency) continue;
    if (shippingValue === undefined || !item.itemWebUrl) continue;
    if (isNotThisBook(listing, by)) continue;

    // which of three things it is. On an edition page the edition's word is
    // part of the series' name ("Death Note Black Edition"), so it's read on
    // the whole title there
    const isOmnibus =
      isOmnibusListing(rest) || (omnibusPage && isOmnibusListing(name));
    // this page's own omnibus: named as one, or found by its ISBN under any
    // name ("One Piece: East Blue 1-2-3") unless it's plainly a box or a lot
    const foundByIsbnAsOneBook =
      by === "isbn" && !isSingleVolume(rest) && !severalBooks(rest);
    const isThePagesOmnibus =
      omnibusPage &&
      fitsOmnibusPage(rest, title) &&
      (isOmnibus || foundByIsbnAsOneBook);
    // a box set or an omnibus holding this volume among others
    const isSet = !isThePagesOmnibus && (isOmnibus || !isSingleVolume(rest));

    let fits: boolean;
    if (isThePagesOmnibus) fits = ownOmnibusFits(listing, asked);
    else if (isSet) fits = setFits(listing, isOmnibus, asked);
    else fits = singleFits(listing, asked);
    if (!fits) continue;

    // prices include shipping
    const priceCents =
      toCents(Number(item.price.value)) + toCents(Number(shippingValue));
    const condition = item.conditionId === "1000" ? "new" : "used";
    if (!priceIsPlausible(priceCents, condition, isSet, rest, by)) continue;

    let format: Offer["format"] = "print";
    if (isSet) format = isOmnibus ? "omnibus" : "set";
    // US links carry eBay US tracking here; Canadian ones get eBay Canada's
    // where they're shown (prices/canada)
    const url =
      market === "US"
        ? (item.itemAffiliateWebUrl ??
          ebayAffiliateUrl(item.itemWebUrl, "listing"))
        : item.itemWebUrl;
    offers.push({
      store,
      format,
      condition,
      priceCents,
      currency,
      inStock: true,
      url,
    });
  }
  return cheapestOfEach(offers);
}

// what a title search asks for: the series, "light novel" for a novel, and
// the volume number ("Overlord light novel vol 16"), or "box set" for sets.
// null when the volume has no number to search by
// "Attack on Titan Omnibus 9 (Vol. 25-27)" as matched and searched for:
// "Attack on Titan Omnibus 9"
const omnibusTitle = (title: string) =>
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
// cheapest first. A title search (category set) only while today's count is
// under 80%
async function browse(
  q: string,
  market: EbayMarket,
  signal: AbortSignal,
  category?: string,
): Promise<ItemSummary[]> {
  await syncWithEbay(signal);
  // the token first: a failed one isn't a search, so it takes no call
  const token = await appToken(signal);
  const day = today();
  if (
    !(await priceQueries.claimApiCall(
      budgetLabel(day),
      category ? titleLimit() : dailyLimit(),
      monthOf(day),
    ))
  )
    throw new SearchesUsedUp(`eBay calls used up for ${day}`);
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
      Authorization: `Bearer ${token}`,
      "X-EBAY-C-MARKETPLACE-ID": id,
      // asks eBay to include affiliate links in US results
      ...(campaignId &&
        market === "US" && {
          "X-EBAY-C-ENDUSERCTX": `affiliateCampaignId=${campaignId}`,
        }),
    },
    signal,
  });
  if (res.status === 429) {
    // too many calls: eBay's own count says whether it's the day's allowance
    // (then ours is raised to it) or a short burst (this search just fails).
    // If it can't be read, the day is closed to be safe
    if (!(await syncWithEbay(signal, true)))
      await markDayUsed(day, dailyLimit());
    throw new SearchesUsedUp("eBay answered 429: too many calls");
  }
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

// a series' box sets, looked for by its name alone: one search ("Naruto box
// set"), read against a few of its volumes (first, middle, last) so a set
// holding any part of the run is found, by the same rules a volume's own
// check uses. Counts as one title search against the day's allowance
export async function searchEbaySets(
  volumeTitles: string[],
  signal: AbortSignal,
): Promise<Offer[]> {
  if (!volumeTitles.length) return [];
  const items = await browse(
    titleQueries(volumeTitles[0]!).sets,
    "US",
    signal,
    BOOKS_CATEGORY,
  );
  const byListing = new Map<string, Offer>();
  for (const title of volumeTitles)
    for (const offer of browseOffers(items, title, "US", "title"))
      if (offer.format === "set")
        byListing.set(offer.url ?? `${offer.priceCents}`, offer);
  return [...byListing.values()];
}

const ebay: Provider = {
  id: "ebay",
  store: "eBay",
  enabled: ebayApiEnabled,
  fetchOffers: (isbn13, signal, book) =>
    searchEbay(isbn13, book.title, "US", signal),
};

export default ebay;
