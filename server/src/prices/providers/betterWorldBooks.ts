// Better World Books through impact.com, where we're their affiliate: Impact's
// catalog search reads the product feed they send it (about two million
// books, refreshed daily), so this is their own listed price, not a scrape.
// Mostly used copies, which is what they're for. Free: Impact allows 3,000
// requests an hour.
//
// The feed is not their whole shop: a book on their site can be missing here
// (it lists what's in stock to affiliates). No answer is "they don't have it
// now", never an error.
//
// Needs IMPACT_ACCOUNT_SID and IMPACT_AUTH_TOKEN (a token with the Catalogs
// scope; see config.ts). An item's own link already carries our tracking and
// goes to that book's page.
// https://integrations.impact.com/impact-publisher/reference/search-catalog-items
import config from "../../config/config.js";
import type { Offer, Provider } from "../types.js";
import { SearchesUsedUp } from "./serpapiKeys.js";

const STORE = "Better World Books";
// Impact's catalog search takes a list of ISBNs in one request
const MOST_AT_ONCE = 50;
const PAGE_SIZE = 100;
// an answer longer than this many pages is cut short and treated as a
// failure: 50 ISBNs are a page or two
const MOST_PAGES = 5;

// one book of a feed, as much of it as a price needs
export type FeedItem = {
  // the store whose feed it's from: the search covers every store we've
  // joined on Impact, not only this one
  CampaignName?: string | null;
  Gtin?: string | null;
  Name?: string | null;
  CurrentPrice?: string | null;
  Currency?: string | null;
  Condition?: string | null;
  StockAvailability?: string | null;
  Url?: string | null;
};

const enabled = () =>
  Boolean(config.IMPACT_ACCOUNT_SID && config.IMPACT_AUTH_TOKEN);

// their feed's words for a copy's state, as ours. Anything that isn't plainly
// new is used: it's a used-book shop
const conditionOf = (item: FeedItem): Offer["condition"] =>
  /^new$/i.test(item.Condition?.trim() ?? "") ? "new" : "used";

// a feed item as a price on a volume's page; null for one with no price in
// dollars
export function offerFromItem(item: FeedItem): Offer | null {
  const amount = Number(item.CurrentPrice);
  if (item.Currency !== "USD" || !Number.isFinite(amount) || amount <= 0)
    return null;
  return {
    store: STORE,
    format: "print",
    condition: conditionOf(item),
    priceCents: Math.round(amount * 100),
    currency: "USD",
    inStock: /^in\s*stock$/i.test(item.StockAvailability?.trim() ?? ""),
    url: item.Url ?? null,
  };
}

// Is this item Better World Books' own? Impact's search answers from every
// store we've joined there, so a second store's book mustn't be saved under
// this one's name
const isTheirs = (item: FeedItem) =>
  /^better world books$/i.test(item.CampaignName?.trim() ?? "");

type Page = { Items?: FeedItem[]; "@nextpageuri"?: string | null };

// one page of Impact's answer. `path` starts at /Mediapartners
async function getPage(path: string, signal: AbortSignal): Promise<Page> {
  const login = Buffer.from(
    `${config.IMPACT_ACCOUNT_SID}:${config.IMPACT_AUTH_TOKEN}`,
  ).toString("base64");
  const res = await fetch(`https://api.impact.com${path}`, {
    headers: { Authorization: `Basic ${login}`, Accept: "application/json" },
    signal,
  });
  // the hour's allowance is gone: this check fails quietly, prices stay
  if (res.status === 429) throw new SearchesUsedUp("Impact answered 429");
  if (!res.ok) throw new Error(`Impact catalog search responded ${res.status}`);
  return (await res.json()) as Page;
}

// Better World Books' feed items for these ISBNs (up to MOST_AT_ONCE), every
// page of the answer: a book can be listed more than once, so the answer can
// be longer than the question. ISBNs are digits only by the time they get
// here, so the query is safe to build from them
async function search(
  isbns: string[],
  signal: AbortSignal,
): Promise<FeedItem[]> {
  const digitsOnly = isbns.filter((isbn) => /^\d{13}$/.test(isbn));
  if (!digitsOnly.length) return [];
  const sid = encodeURIComponent(config.IMPACT_ACCOUNT_SID!);
  const params = new URLSearchParams({
    Query: `Gtin IN (${digitsOnly.map((isbn) => `'${isbn}'`).join(",")})`,
    PageSize: String(PAGE_SIZE),
  });
  const items: FeedItem[] = [];
  let next: string | null =
    `/Mediapartners/${sid}/Catalogs/ItemSearch?${params}`;
  for (let page = 0; next; page++) {
    // never a half answer: "they don't have it" is kept for good by
    // collector/usedFiller.ts, so it has to be true
    if (page >= MOST_PAGES) throw new Error("Impact's answer was too long");
    const body = await getPage(next, signal);
    items.push(...(body.Items ?? []));
    next = body["@nextpageuri"] || null;
  }
  return items.filter(isTheirs);
}

// the copy to show when the feed lists a book more than once: one in stock
// before one that isn't, then the cheapest. Null with no priced copy
export function bestOffer(items: FeedItem[]): Offer | null {
  let best: Offer | null = null;
  for (const item of items) {
    const offer = offerFromItem(item);
    if (!offer) continue;
    const isBetter =
      !best ||
      (offer.inStock && !best.inStock) ||
      (offer.inStock === best.inStock && offer.priceCents < best.priceCents);
    if (isBetter) best = offer;
  }
  return best;
}

// their price for each of these volumes, by ISBN: for a whole shelf at once.
// A volume they don't have isn't in the answer
export async function bwbOffers(isbns: string[], signal: AbortSignal) {
  const offers = new Map<string, Offer>();
  if (!enabled()) return offers;
  for (let at = 0; at < isbns.length; at += MOST_AT_ONCE) {
    const asked = isbns.slice(at, at + MOST_AT_ONCE);
    const found = await search(asked, signal);
    for (const isbn13 of asked) {
      // only the exact ISBN asked for
      const offer = bestOffer(found.filter((item) => item.Gtin === isbn13));
      if (offer) offers.set(isbn13, offer);
    }
  }
  return offers;
}

const betterWorldBooks: Provider = {
  id: "better-world-books",
  store: STORE,
  enabled,

  async fetchOffers(isbn13, signal) {
    const found = await search([isbn13], signal);
    const offer = bestOffer(found.filter((item) => item.Gtin === isbn13));
    return offer ? [offer] : [];
  },
};

export default betterWorldBooks;
