import {
  amazonTag,
  bookshopId,
  ebayAffiliateUrl,
  ebayCampaignId,
} from "./affiliates.js";

// stores without a price API we can use: we link to them for this ISBN so
// people can check the price there themselves. Stores with an affiliate
// setting in server/.env (see affiliates.js) get affiliate links
const amazonUrl = (isbn13) => {
  const params = new URLSearchParams({ k: isbn13 });
  if (amazonTag()) params.set("tag", amazonTag());
  return `https://www.amazon.com/s?${params}`;
};

// with an affiliate ID, Bookshop's own link format goes straight to the
// book's page; without one, a plain search
const bookshopUrl = (isbn13) =>
  bookshopId()
    ? `https://bookshop.org/a/${encodeURIComponent(bookshopId())}/${isbn13}`
    : `https://bookshop.org/search?keywords=${isbn13}`;

const ebayUrl = (isbn13, source = "store-link") =>
  ebayAffiliateUrl(
    `https://www.ebay.com/sch/i.html?${new URLSearchParams({ _nkw: isbn13 })}`,
    source,
  );

const isGoogleLink = (url) => {
  try {
    return /(^|\.)google\.com$/.test(new URL(url).hostname);
  } catch {
    return false;
  }
};

// Google Shopping rows link to a Google page, and the click from there to
// the store carries none of our affiliate tracking. When the store is one
// we're an affiliate of, send people straight there for this ISBN instead.
// Real store links (e.g. from the eBay API) are left as they are
export function affiliateOfferUrl(store, isbn13, url) {
  if (!isGoogleLink(url)) return url;
  if (/\bebay\b/i.test(store) && ebayCampaignId()) {
    return ebayUrl(isbn13, "shopping");
  }
  if (/\bamazon\b/i.test(store) && amazonTag()) return amazonUrl(isbn13);
  if (/\bbookshop\b/i.test(store) && bookshopId()) return bookshopUrl(isbn13);
  return url;
}

export const amazonAffiliate = () => Boolean(amazonTag());

export const storeLinks = (isbn13) => [
  { store: "Amazon", url: amazonUrl(isbn13), affiliate: amazonAffiliate() },
  {
    store: "Barnes & Noble",
    url: `https://www.barnesandnoble.com/s/${isbn13}`,
    affiliate: false,
  },
  {
    store: "Bookshop.org",
    url: bookshopUrl(isbn13),
    affiliate: Boolean(bookshopId()),
  },
  {
    store: "Walmart",
    url: `https://www.walmart.com/search?q=${isbn13}`,
    affiliate: true,
  },
  { store: "eBay", url: ebayUrl(isbn13), affiliate: Boolean(ebayCampaignId()) },
  {
    store: "Books-A-Million",
    url: `https://www.booksamillion.com/search?query=${isbn13}`,
    affiliate: false,
  },
];
