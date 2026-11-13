// What a season's panel needs to send someone straight to a store: each
// volume's cheapest new copy, and its cheapest used one (Better World Books'
// are the usual ones), in stock at a store readers know by name, as last
// saved, with the store's link (ours, where we have an affiliate tag)
// and when that store was last asked. A seller nobody has heard of is left
// to the volume's own page, where every price is. Saved prices only: nothing
// here looks a price up.
//
// The client's copy of these types is in client/src/lib/afterAnime.ts.
import priceQueries from "../../models/priceQueries.js";
import { affiliateOfferUrl, isAffiliateUrl } from "../stores/storeLinks.js";
import { isWellKnown, shopName } from "../volumeNames.js";

// a copy to buy: new, or used (the cheaper way in under the new one, or the
// only one when no new copy is priced)
export type BuyOffer = {
  cents: number;
  // the store's own name: a seller on eBay is "eBay", not "eBay - their-name"
  store: string;
  url: string;
  // the link carries our affiliate tag
  affiliate: boolean;
  // when this store was last asked for this price
  checkedAt: Date;
};

export type VolumeOffers = { new: BuyOffer | null; used: BuyOffer | null };

// by ISBN; a volume with neither a new nor a used copy to link to isn't in it
export async function buyOffers(isbns: string[]) {
  const copies = await priceQueries.getCheapestCopies(isbns, isWellKnown);
  const offers: Record<string, VolumeOffers> = {};
  for (const isbn of isbns) {
    const cheapest = copies.get(isbn);
    const newCopy = linked(cheapest?.new, "new", isbn);
    const usedCopy = linked(cheapest?.used, "used", isbn);
    if (newCopy || usedCopy) offers[isbn] = { new: newCopy, used: usedCopy };
  }
  return offers;
}

type SavedCopy = {
  cents: number;
  store: string;
  url: string | null;
  checkedAt: Date;
};

// a copy with the store's link (ours, where we have a tag); null when there's
// no copy, or no link to it
function linked(
  copy: SavedCopy | null | undefined,
  condition: "new" | "used",
  isbn: string,
): BuyOffer | null {
  if (!copy) return null;
  const url = affiliateOfferUrl({ ...copy, format: "print", condition }, isbn);
  if (!url) return null;
  return {
    cents: copy.cents,
    store: shopName(copy.store),
    url,
    affiliate: isAffiliateUrl(url),
    checkedAt: copy.checkedAt,
  };
}
