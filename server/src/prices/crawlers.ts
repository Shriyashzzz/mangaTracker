// Search engines and link-preview fetchers. They get the prices we already
// have and never set off a paid refresh: a crawl of every volume in the
// sitemap would otherwise spend the month's SerpApi searches in a day,
// leaving real visitors with stale prices
const CRAWLER =
  /bot\b|bot\/|crawl|spider|slurp|facebookexternalhit|embedly|whatsapp|telegram|discord|slack|skype|vkshare|pinterest|google-inspectiontool|lighthouse|headlesschrome|mangatracker-preview/i;

export const isCrawler = (userAgent = "") => CRAWLER.test(userAgent);
