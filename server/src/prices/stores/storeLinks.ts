// Links out to stores. Two jobs:
//  1. storeLinks(): stores without a price API we can use. We link to their
//     search for this ISBN so people can check the price there themselves.
//  2. affiliateOfferUrl(): rewrites an offer's link so it carries our
//     affiliate tracking when the store is one we're an affiliate of.
// Stores with an affiliate setting in server/.env (see affiliates.ts) get
// affiliate links.
import {
  amazonTag,
  bamAffiliateUrl,
  betterWorldBooksLink,
  bookshopId,
  bwbAffiliateUrl,
  CJ_CLICK_HOSTS,
  cjWebsiteId,
  ebayAffiliateUrl,
  ebayCampaignId,
  walmartAffiliate,
} from "./affiliates.js";
import type { Offer } from "../types.js";

export type StoreLink = { store: string; url: string; affiliate: boolean };

const amazonUrl = (isbn13: string) => {
  const params = new URLSearchParams({ k: isbn13 });
  const tag = amazonTag();
  if (tag) params.set("tag", tag);
  return `https://www.amazon.com/s?${params}`;
};

// with an affiliate ID, Bookshop's own link format goes straight to the
// book's page; without one, a plain search
const bookshopUrl = (isbn13: string) => {
  const id = bookshopId();
  return id
    ? `https://bookshop.org/a/${encodeURIComponent(id)}/${isbn13}`
    : `https://bookshop.org/search?keywords=${isbn13}`;
};

const ebayUrl = (isbn13: string, source = "store-link") =>
  ebayAffiliateUrl(
    `https://www.ebay.com/sch/i.html?${new URLSearchParams({ _nkw: isbn13 })}`,
    source,
  );

const isGoogleLink = (url: string | null) => {
  if (!url) return false;
  try {
    return /(^|\.)google\.com$/.test(new URL(url).hostname);
  } catch {
    return false;
  }
};

// Google Shopping store names for the affiliate stores themselves. Exact
// names only: "Kinokuniya Bookshop" isn't Bookshop.org, and "eBay - seller"
// is eBay itself
// stores Google Shopping names its own way, as the store links name them, so
// one store is one row ("Barnes and Noble" and "Barnes & Noble" alike)
const STORE_NAMES: Record<string, string> = {
  "books a million": "Books-A-Million",
  "barnes and noble": "Barnes & Noble",
  "barnes & noble": "Barnes & Noble",
};
export const storeName = (store: string) =>
  STORE_NAMES[
    store
      .toLowerCase()
      .replace(/[^a-z0-9&]+/g, " ")
      .trim()
  ] ?? store;

export const EBAY = /^ebay( - .+)?$/i;
export const AMAZON = /^amazon(\.com)?$/i;
const BOOKSHOP = /^bookshop(\.org)?$/i;
export const BOOKS_A_MILLION = /^books[- ]?a[- ]?million(\.com)?$/i;
const BETTER_WORLD_BOOKS = /^better ?world ?books(\.com)?$/i;

const bamSearchUrl = (isbn13: string) =>
  bamAffiliateUrl(`https://www.booksamillion.com/search?query=${isbn13}`);

// with a row straight from eBay or Amazon, the same store's Google
// Shopping rows only repeat it with a worse link, so they go
export function preferDirectRows<T extends Pick<Offer, "store" | "url">>(
  offers: T[],
): T[] {
  const direct = [EBAY, AMAZON, BOOKS_A_MILLION].filter((store) =>
    offers.some((o) => store.test(o.store) && o.url && !isGoogleLink(o.url)),
  );
  return offers.filter(
    (o) => !isGoogleLink(o.url) || !direct.some((store) => store.test(o.store)),
  );
}

// Google Shopping rows link to a Google page, and the click from there to
// the store carries none of our affiliate tracking. For a new print copy
// from a store we're an affiliate of, send people straight to that store's
// listing for this ISBN instead. Anything else (used or marketplace copies
// at Amazon, ebooks, other shops, real store links) keeps its own link
export function affiliateOfferUrl(
  offer: Pick<Offer, "store" | "url" | "format" | "condition">,
  isbn13: string,
): string | null {
  const { store, url } = offer;
  if (!isGoogleLink(url)) return ourTags(url);
  if (EBAY.test(store) && ebayCampaignId()) return ebayUrl(isbn13, "shopping");
  // its page for an ISBN lists every copy, new and used, so any print copy's
  // row can go there
  if (
    BETTER_WORLD_BOOKS.test(store) &&
    betterWorldBooksLink() &&
    offer.format === "print"
  )
    return bwbSearchUrl(isbn13);
  const newPrint = offer.format === "print" && offer.condition === "new";
  if (!newPrint) return url;
  if (AMAZON.test(store) && amazonTag()) return amazonUrl(isbn13);
  if (BOOKSHOP.test(store) && bookshopId()) return bookshopUrl(isbn13);
  if (BOOKS_A_MILLION.test(store) && cjWebsiteId()) return bamSearchUrl(isbn13);
  return url;
}

// Better World Books' own search for an ISBN, through our Impact link when
// there is one
const bwbSearchUrl = (isbn13: string) =>
  bwbAffiliateUrl(
    `https://www.betterworldbooks.com/search/results?${new URLSearchParams({ q: isbn13 })}`,
  );

// the site itself or one of its subdomains, never a lookalike like notebay.com
const isSite = (host: string, site: string) =>
  host === site || host.endsWith(`.${site}`);

const parse = (url: string) => {
  try {
    return new URL(url);
  } catch {
    return null;
  }
};

// a store link with someone else's affiliate tag on it, from a search result
// or saved before our tag changed, gets ours instead, or none if we have none
export function ourTags(url: string | null): string | null {
  const link = url && parse(url);
  if (!link) return url;
  const host = link.hostname;
  if (isSite(host, "amazon.com") && link.searchParams.has("tag")) {
    const tag = amazonTag();
    if (link.searchParams.get("tag") === tag) return url;
    if (tag) link.searchParams.set("tag", tag);
    else link.searchParams.delete("tag");
    return link.toString();
  }
  // a listing saved before the campaign ID was set (or without one) gets it
  // when shown, so no click goes untracked while it waits for a new check
  if (
    isSite(host, "ebay.com") &&
    !link.searchParams.has("campid") &&
    ebayCampaignId() &&
    link.pathname.startsWith("/itm/")
  )
    return ebayAffiliateUrl(url, "listing");
  if (isSite(host, "ebay.com") && link.searchParams.has("campid")) {
    if (link.searchParams.get("campid") === ebayCampaignId()) return url;
    if (ebayCampaignId()) return ebayAffiliateUrl(url);
    for (const p of [
      "campid",
      "mkcid",
      "mkrid",
      "siteid",
      "customid",
      "toolid",
      "mkevt",
    ])
      link.searchParams.delete(p);
    return link.toString();
  }
  return url;
}

// whether a link earns us anything, so the page can mark it rel="sponsored":
// our own tag on the store's own site
export function isAffiliateUrl(url: string | null): boolean {
  const link = url && parse(url);
  if (!link) return false;
  const host = link.hostname;
  if (isSite(host, "ebay.com"))
    return (
      Boolean(ebayCampaignId()) &&
      link.searchParams.get("campid") === ebayCampaignId()
    );
  if (isSite(host, "amazon.com"))
    return Boolean(amazonTag()) && link.searchParams.get("tag") === amazonTag();
  if (isSite(host, "bookshop.org")) return link.pathname.startsWith("/a/");
  if (isSite(host, "walmart.com")) return walmartAffiliate();
  // our own Impact link for Better World Books, whatever page it goes on to
  const bwb = betterWorldBooksLink();
  if (bwb && url!.startsWith(`${bwb}?`)) return true;
  // a CJ click link carries the website ID it pays
  if (CJ_CLICK_HOSTS.some((site) => isSite(host, site))) {
    const pid = cjWebsiteId();
    return Boolean(pid) && link.pathname.includes(pid!);
  }
  return false;
}

// searches for a series' box sets at the stores that sell them, with our
// affiliate tags where we have them: collectors buy whole runs in sets
export const boxSetLinks = (series: string): StoreLink[] => {
  const query = `${series} manga box set`;
  const amazon = new URLSearchParams({ k: query });
  if (amazonTag()) amazon.set("tag", amazonTag()!);
  return [
    {
      store: "Amazon",
      url: `https://www.amazon.com/s?${amazon}`,
      affiliate: Boolean(amazonTag()),
    },
    {
      store: "eBay",
      url: ebayAffiliateUrl(
        `https://www.ebay.com/sch/i.html?${new URLSearchParams({ _nkw: query })}`,
        "box-sets",
      ),
      affiliate: Boolean(ebayCampaignId()),
    },
    {
      store: "Books-A-Million",
      url: bamAffiliateUrl(
        `https://www.booksamillion.com/search?${new URLSearchParams({ query })}`,
      ),
      affiliate: Boolean(cjWebsiteId()),
    },
    {
      store: "Barnes & Noble",
      url: `https://www.barnesandnoble.com/s/${encodeURIComponent(query)}`,
      affiliate: false,
    },
  ];
};

export const storeLinks = (isbn13: string): StoreLink[] => [
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
    url: bamSearchUrl(isbn13),
    affiliate: Boolean(cjWebsiteId()),
  },
  // new and used copies: often the cheapest way to an older volume
  {
    store: "Better World Books",
    url: bwbSearchUrl(isbn13),
    affiliate: Boolean(betterWorldBooksLink()),
  },
];
