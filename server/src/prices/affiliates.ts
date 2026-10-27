// Affiliate settings, each switched on by its own line in server/.env:
//   AMAZON_ASSOCIATE_TAG   Amazon Associates tracking ID, e.g. "yourname-20"
//   BOOKSHOP_AFFILIATE_ID  Bookshop.org affiliate ID (a number)
//   EBAY_CAMPAIGN_ID       eBay Partner Network campaign ID (10 digits)
//   WALMART_AFFILIATE      set to "on" once Impact has approved the Walmart
//                          program. The Impact script in client/index.html
//                          turns Walmart links into affiliate links in the
//                          browser; this only says whether that earns
import config from "../config/config.js";

export const amazonTag = () => config.AMAZON_ASSOCIATE_TAG ?? null;
export const bookshopId = () => config.BOOKSHOP_AFFILIATE_ID ?? null;
export const ebayCampaignId = () => config.EBAY_CAMPAIGN_ID ?? null;
export const walmartAffiliate = () => config.WALMART_AFFILIATE === "on";

// eBay Partner Network click tracking for ebay.com, per
// https://developer.ebay.com/api-docs/buy/static/ref-epn-link.html
const EBAY_US_ROTATION_ID = "711-53200-19255-0";

// matches the links EPN's own "Create a promotable link" makes. `source`
// becomes the customid, so EPN reports show which part of the app earned
export function ebayAffiliateUrl<T extends string | null | undefined>(
  url: T,
  source?: string,
): T {
  const campid = ebayCampaignId();
  if (!campid || !url) return url;
  const link = new URL(url);
  if (link.searchParams.has("campid")) return url;
  link.searchParams.set("mkcid", "1"); // eBay Partner Network
  link.searchParams.set("mkrid", EBAY_US_ROTATION_ID);
  link.searchParams.set("siteid", "0"); // ebay.com
  link.searchParams.set("campid", campid);
  if (source) link.searchParams.set("customid", source);
  link.searchParams.set("toolid", "10001");
  link.searchParams.set("mkevt", "1"); // a click
  return link.toString() as T;
}
