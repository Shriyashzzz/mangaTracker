// "Sales right now": store-wide deals, kept by hand. Add one when a store runs
// a sale and give it an end date; it hides itself once that day is over.
// Amazon and eBay links get our tag on the way out. Bookshop.org's
// store-wide pages have no one form to tag: paste its affiliate link as is
// (bookshop.org/a/130460/... or a link from its affiliate dashboard).
// Shown on the price pages (never in their search data). Example:
// {
//   store: "Books-A-Million",
//   text: "20% off all manga",
//   code: "15NOV26",              // optional coupon code
//   url: "https://www.booksamillion.com/manga",
//   ends: "2026-11-30",           // the last day it runs
// },
import { ebayAffiliateUrl } from "../prices/stores/affiliates.js";
import { ourTags } from "../prices/stores/storeLinks.js";
import config from "../config/config.js";

export type Deal = {
  store: string;
  text: string;
  code?: string;
  url: string;
  // the last day it runs, "YYYY-MM-DD" (through the end of that day, US time)
  ends: string;
};

const DEALS: Deal[] = [];

// the deals still running: through the whole of their last day, wherever in
// the US someone is (until 8am UTC the next day)
export function liveDeals(deals: Deal[] = DEALS, now = new Date()): Deal[] {
  return deals.filter((d) => {
    const [y, m, day] = d.ends.split("-").map(Number);
    if (!y || !m || !day) return false;
    return now.getTime() < Date.UTC(y, m - 1, day + 1, 8);
  });
}

// a store's link with our tag, where we have one: Amazon's associate tag,
// eBay's campaign. Anything else goes as written
export function dealLink(url: string): string {
  let link: URL;
  try {
    link = new URL(url);
  } catch {
    return url;
  }
  const host = link.hostname.replace(/^www\./, "");
  if (host === "amazon.com" || host.endsWith(".amazon.com")) {
    const tag = config.AMAZON_ASSOCIATE_TAG;
    if (tag) link.searchParams.set("tag", tag);
    return link.toString();
  }
  if (host === "ebay.com" || host.endsWith(".ebay.com"))
    return ebayAffiliateUrl(link.toString(), "deal");
  return ourTags(url) ?? url;
}
