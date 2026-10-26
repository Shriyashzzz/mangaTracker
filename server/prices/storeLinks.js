import {
  amazonTag,
  bookshopId,
  ebayAffiliateUrl,
  ebayCampaignId,
  walmartAffiliate,
} from "./affiliates.js";

// stores without a price API we can use: we link to them for this ISBN so
// people can check the price there themselves. Stores with an affiliate
// setting in server/.env (see affiliates.js) get affiliate links
const amazonUrl = (isbn13) => {
  const params = new URLSearchParams({ k: isbn13 });
  const tag = amazonTag();
  if (tag) params.set("tag", tag);
  return `https://www.amazon.com/s?${params}`;
};

// with an affiliate ID, Bookshop's own link format goes straight to the
// book's page; without one, a plain search
const bookshopUrl = (isbn13) => {
  const id = bookshopId();
  return id
    ? `https://bookshop.org/a/${encodeURIComponent(id)}/${isbn13}`
    : `https://bookshop.org/search?keywords=${isbn13}`;
};

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

// Google Shopping store names for the affiliate stores themselves. Exact
// names only: "Kinokuniya Bookshop" isn't Bookshop.org, and "eBay - seller"
// is eBay itself
const EBAY = /^ebay( - .+)?$/i;
const AMAZON = /^amazon(\.com)?$/i;
const BOOKSHOP = /^bookshop(\.org)?$/i;

// Google Shopping rows link to a Google page, and the click from there to
// the store carries none of our affiliate tracking. For a new print copy
// from a store we're an affiliate of, send people straight to that store's
// listing for this ISBN instead. Anything else (used or marketplace copies
// at Amazon, ebooks, other shops, real store links) keeps its own link
export function affiliateOfferUrl(offer, isbn13) {
  const { store, url } = offer;
  if (!isGoogleLink(url)) return url;
  if (EBAY.test(store) && ebayCampaignId()) {
    return ebayUrl(isbn13, "shopping");
  }
  const newPrint = offer.format === "print" && offer.condition === "new";
  if (!newPrint) return url;
  if (AMAZON.test(store) && amazonTag()) return amazonUrl(isbn13);
  if (BOOKSHOP.test(store) && bookshopId()) return bookshopUrl(isbn13);
  return url;
}

// whether a link earns us anything, so the page can mark it rel="sponsored"
export function isAffiliateUrl(url) {
  let link;
  try {
    link = new URL(url);
  } catch {
    return false;
  }
  const host = link.hostname.replace(/^www\./, "");
  if (host.endsWith("ebay.com")) return link.searchParams.has("campid");
  if (host === "amazon.com") return link.searchParams.has("tag");
  if (host === "bookshop.org") return link.pathname.startsWith("/a/");
  if (host.endsWith("walmart.com")) return walmartAffiliate();
  return false;
}

export const storeLinks = (isbn13) => [
  { store: "Amazon", url: amazonUrl(isbn13), affiliate: Boolean(amazonTag()) },
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
    affiliate: walmartAffiliate(),
  },
  { store: "eBay", url: ebayUrl(isbn13), affiliate: Boolean(ebayCampaignId()) },
  {
    store: "Books-A-Million",
    url: `https://www.booksamillion.com/search?query=${isbn13}`,
    affiliate: false,
  },
];
