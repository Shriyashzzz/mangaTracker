// Affiliate settings, each switched on by its own line in server/.env:
//   AMAZON_ASSOCIATE_TAG   Amazon Associates tracking ID, e.g. "yourname-20"
//   BOOKSHOP_AFFILIATE_ID  Bookshop.org affiliate ID (a number)
//   EBAY_CAMPAIGN_ID       eBay Partner Network campaign ID (10 digits)
// Walmart links are turned into affiliate links in the browser by the
// Impact script in client/index.html.
const setting = (name) => process.env[name]?.trim() || null;

export const amazonTag = () => setting("AMAZON_ASSOCIATE_TAG");
export const bookshopId = () => setting("BOOKSHOP_AFFILIATE_ID");
export const ebayCampaignId = () => setting("EBAY_CAMPAIGN_ID");

// eBay Partner Network click tracking for ebay.com, per
// https://developer.ebay.com/api-docs/buy/static/ref-epn-link.html
const EBAY_US_ROTATION_ID = "711-53200-19255-0";

// matches the links EPN's own "Create a promotable link" makes. `source`
// becomes the customid, so EPN reports show which part of the app earned
export function ebayAffiliateUrl(url, source) {
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
  return link.toString();
}
