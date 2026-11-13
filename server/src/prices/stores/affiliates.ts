// Affiliate settings, each switched on by its own line in server/.env:
//   AMAZON_ASSOCIATE_TAG   Amazon Associates tracking ID, e.g. "yourname-20"
//   BOOKSHOP_AFFILIATE_ID  Bookshop.org affiliate ID (a number)
//   EBAY_CAMPAIGN_ID       eBay Partner Network campaign ID (10 digits)
//   WALMART_AFFILIATE      set to "on" once Impact has approved the Walmart
//                          program. The Impact script in client/index.html
//                          turns Walmart links into affiliate links in the
//                          browser; this only says whether that earns
//   CJ_WEBSITE_ID          our CJ website ID (PID): Books-A-Million links go
//                          through CJ with it
import config from "../../config/config.js";

export const amazonTag = () => config.AMAZON_ASSOCIATE_TAG ?? null;
export const bookshopId = () => config.BOOKSHOP_AFFILIATE_ID ?? null;
export const ebayCampaignId = () => config.EBAY_CAMPAIGN_ID ?? null;
export const walmartAffiliate = () => config.WALMART_AFFILIATE === "on";
export const cjWebsiteId = () => config.CJ_WEBSITE_ID ?? null;

// a Books-A-Million page through CJ's deep link, so the click is ours: CJ
// sends people on to the page itself. Without a website ID, the page as is
export const bamAffiliateUrl = (url: string) => {
  const pid = cjWebsiteId();
  return pid
    ? `https://www.anrdoezrs.net/links/${encodeURIComponent(pid)}/type/dlg/${url}`
    : url;
};
// Better World Books, through impact.com. The setting is our tracking link
// for the program, in full: https://betterworldbooks.pxf.io/c/<account>/<ad>/<campaign>
// (a short "vanity" link from the dashboard redirects to it). Impact sends
// people on to the page named in `u`. Without the setting, the page as is
export const betterWorldBooksLink = () =>
  config.BETTER_WORLD_BOOKS_LINK?.replace(/[/?]+$/, "") ?? null;
// impact.com's partner API is set up: links it hands us carry our tracking
export const impactKeysSet = () =>
  Boolean(config.IMPACT_ACCOUNT_SID && config.IMPACT_AUTH_TOKEN);
export const bwbAffiliateUrl = (url: string) => {
  const link = betterWorldBooksLink();
  return link ? `${link}?u=${encodeURIComponent(url)}` : url;
};

// CJ's own click domains (its links come on any of these)
export const CJ_CLICK_HOSTS = [
  "anrdoezrs.net",
  "dpbolvw.net",
  "jdoqocy.com",
  "kqzyfj.com",
  "tkqlhce.com",
];

// eBay Partner Network click tracking for ebay.com, per
// https://developer.ebay.com/api-docs/buy/static/ref-epn-link.html
const EBAY_US_ROTATION_ID = "711-53200-19255-0";

// eBay Canada's own codes, per EPN's link generator
export const EBAY_CA = { rotationId: "706-53473-19255-0", siteId: "2" };
const EBAY_US = { rotationId: EBAY_US_ROTATION_ID, siteId: "0" };

// matches the links EPN's own "Create a promotable link" makes. `source`
// becomes the customid, so EPN reports show which part of the app earned.
// ebay.com unless `site` says otherwise (EBAY_CA for ebay.ca). A link that
// can't be read stays as it came
export function ebayAffiliateUrl<T extends string | null | undefined>(
  url: T,
  source?: string,
  site: { rotationId: string; siteId: string } = EBAY_US,
): T {
  const campid = ebayCampaignId();
  if (!campid || !url) return url;
  let link: URL;
  try {
    link = new URL(url);
  } catch {
    return url;
  }
  // a campid already on it is someone else's: ours replaces it
  link.searchParams.set("mkcid", "1"); // eBay Partner Network
  link.searchParams.set("mkrid", site.rotationId);
  link.searchParams.set("siteid", site.siteId);
  link.searchParams.set("campid", campid);
  // someone else's label never stays on our link
  if (source) link.searchParams.set("customid", source);
  else link.searchParams.delete("customid");
  link.searchParams.set("toolid", "10001");
  link.searchParams.set("mkevt", "1"); // a click
  return link.toString() as T;
}
