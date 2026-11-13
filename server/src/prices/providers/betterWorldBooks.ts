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

// one book of their feed, as much of it as a price needs
export type FeedItem = {
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

// the feed's items for these ISBNs (up to MOST_AT_ONCE), in one request.
// ISBNs are digits only by the time they get here, so the query is safe to
// build from them
async function search(
  isbns: string[],
  signal: AbortSignal,
): Promise<FeedItem[]> {
  const digitsOnly = isbns.filter((isbn) => /^\d{13}$/.test(isbn));
  if (!digitsOnly.length) return [];
  const sid = config.IMPACT_ACCOUNT_SID!;
  const query = `Gtin IN (${digitsOnly.map((isbn) => `'${isbn}'`).join(",")})`;
  const params = new URLSearchParams({
    Query: query,
    PageSize: String(MOST_AT_ONCE),
  });
  const login = Buffer.from(`${sid}:${config.IMPACT_AUTH_TOKEN}`).toString(
    "base64",
  );
  const res = await fetch(
    `https://api.impact.com/Mediapartners/${encodeURIComponent(sid)}/Catalogs/ItemSearch?${params}`,
    {
      headers: { Authorization: `Basic ${login}`, Accept: "application/json" },
      signal,
    },
  );
  // the hour's allowance is gone: this check fails quietly, prices stay
  if (res.status === 429) throw new SearchesUsedUp("Impact answered 429");
  if (!res.ok) throw new Error(`Impact catalog search responded ${res.status}`);
  const body = (await res.json()) as { Items?: FeedItem[] };
  return body.Items ?? [];
}

// their price for each of these volumes, by ISBN: for a whole shelf at once.
// A volume they don't have isn't in the answer
export async function bwbOffers(isbns: string[], signal: AbortSignal) {
  const offers = new Map<string, Offer>();
  if (!enabled()) return offers;
  for (let at = 0; at < isbns.length; at += MOST_AT_ONCE) {
    const asked = new Set(isbns.slice(at, at + MOST_AT_ONCE));
    for (const item of await search([...asked], signal)) {
      const offer = offerFromItem(item);
      // only the exact ISBNs asked for
      if (offer && item.Gtin && asked.has(item.Gtin))
        offers.set(item.Gtin, offer);
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
    const match = found.find((item) => item.Gtin === isbn13);
    const offer = match ? offerFromItem(match) : null;
    return offer ? [offer] : [];
  },
};

export default betterWorldBooks;
