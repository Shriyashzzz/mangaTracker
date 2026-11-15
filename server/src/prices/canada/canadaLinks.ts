// Where Canadian prices link to: Amazon.ca with our Associates tag, eBay.ca
// with eBay Canada's tracking, and each store's own search. Kept apart from
// the checks, so any page showing a Canadian price can link it the same way
// without pulling in the checking code.
import config from "../../config/config.js";
import {
  EBAY_CA,
  ebayAffiliateUrl,
  ebayCampaignId,
} from "../stores/affiliates.js";
import type { Offer } from "../types.js";
import type { Country } from "../../models/priceTables.js";
import { affiliateOfferUrl, isAffiliateUrl } from "../stores/storeLinks.js";

// eBay Partner Network for ebay.ca: the same campaign as the US links, with
// eBay Canada's own codes
const ebayCa = (url: string, source: string) =>
  ebayAffiliateUrl(url, source, EBAY_CA);

// Amazon.ca with our Associates tag when there is one
const amazonCa = (isbn13: string) => {
  const tag = config.CANADA_AMAZON_AFFILIATE;
  return `https://www.amazon.ca/s?k=${isbn13}${tag ? `&tag=${encodeURIComponent(tag)}` : ""}`;
};

export const canadaStoreLinks = (isbn13: string) => [
  {
    store: "Amazon.ca",
    url: amazonCa(isbn13),
    affiliate: Boolean(config.CANADA_AMAZON_AFFILIATE),
  },
  {
    store: "Indigo",
    url: `https://www.indigo.ca/search?q=${isbn13}`,
    affiliate: false,
  },
  {
    store: "eBay.ca",
    url: ebayCa(`https://www.ebay.ca/sch/i.html?_nkw=${isbn13}`, "ca-search"),
    affiliate: Boolean(ebayCampaignId()),
  },
  {
    store: "Walmart.ca",
    url: `https://www.walmart.ca/search?q=${isbn13}`,
    affiliate: false,
  },
];

// A Canadian price's link, as shown: Amazon.ca's row goes to Amazon.ca
// itself, with the tag, rather than through Google; eBay.ca's rows get eBay
// Canada's tracking. Every Canadian price shown anywhere goes through this
export function canadaOfferLink(
  offer: Pick<Offer, "store" | "url">,
  isbn13: string,
): { url: string | null; affiliate: boolean } {
  if (offer.store === "Amazon.ca")
    return {
      url: amazonCa(isbn13),
      affiliate: Boolean(config.CANADA_AMAZON_AFFILIATE),
    };
  if (offer.store === "eBay.ca" && offer.url)
    return {
      url: ebayCa(offer.url, "ca-listing"),
      affiliate: Boolean(ebayCampaignId()),
    };
  return { url: offer.url, affiliate: false };
}

// the series page's "other stores" for box sets, in Canada
export const canadaBoxSetLinks = (series: string) => {
  const query = `${series} manga box set`;
  const tag = config.CANADA_AMAZON_AFFILIATE;
  const amazon = new URLSearchParams({ k: query });
  if (tag) amazon.set("tag", tag);
  return [
    {
      store: "Amazon.ca",
      url: `https://www.amazon.ca/s?${amazon}`,
      affiliate: Boolean(tag),
    },
    {
      store: "eBay.ca",
      url: ebayCa(
        `https://www.ebay.ca/sch/i.html?${new URLSearchParams({ _nkw: query })}`,
        "ca-box-sets",
      ),
      affiliate: Boolean(ebayCampaignId()),
    },
    {
      store: "Indigo",
      url: `https://www.indigo.ca/search?${new URLSearchParams({ q: query })}`,
      affiliate: false,
    },
  ];
};

// a saved price's link in either country: the US price pages' affiliate rules,
// or the Canadian ones above
export function linkFor(
  country: Country,
  offer: Pick<Offer, "store" | "url" | "format" | "condition">,
  isbn13: string,
): { url: string | null; affiliate: boolean } {
  if (country === "ca") return canadaOfferLink(offer, isbn13);
  const url = affiliateOfferUrl(offer, isbn13);
  return { url, affiliate: isAffiliateUrl(url) };
}
