// What a season's panel needs to send someone straight to a store: each
// volume's cheapest new copy, and its cheapest used one (Better World Books'
// are the usual ones), in stock at a store readers know by name, as last
// saved, with the store's link (ours, where we have an affiliate tag)
// and when it was checked. A seller nobody has heard of is left to the
// volume's own page, where every price is. Saved prices only: nothing here
// looks a price up.
import priceQueries from "../../models/priceQueries.js";
import { affiliateOfferUrl, isAffiliateUrl } from "../stores/storeLinks.js";
import { isWellKnown } from "../volumeNames.js";

export type BuyOffer = {
  cents: number;
  store: string;
  url: string;
  // the link carries our affiliate tag
  affiliate: boolean;
  checkedAt: Date;
};

// a used copy, offered as the cheaper way in under the new one (or by
// itself when no new copy is priced). No date: it's said beside the new
// price's, or not at all
export type UsedOffer = Omit<BuyOffer, "checkedAt">;

export type VolumeOffers = { new: BuyOffer | null; used: UsedOffer | null };

// by ISBN; a volume with neither a new nor a used copy to link to isn't in it
export async function buyOffers(isbns: string[]) {
  const [copies, known] = await Promise.all([
    priceQueries.getCheapestCopies(isbns, isWellKnown),
    priceQueries.getKnownPrices(isbns),
  ]);
  const offers: Record<string, VolumeOffers> = {};
  for (const isbn of isbns) {
    const cheapest = copies.get(isbn);
    const newCopy = linked(cheapest?.new, "new", isbn);
    const usedCopy = linked(cheapest?.used, "used", isbn);
    // a new price is shown with when it was checked, or not at all
    const checkedAt = known.get(isbn)?.checkedAt;
    const asNew = newCopy && checkedAt ? { ...newCopy, checkedAt } : null;
    if (asNew || usedCopy) offers[isbn] = { new: asNew, used: usedCopy };
  }
  return offers;
}

// a copy with the store's link (ours, where we have a tag); null when there's
// no copy, or no link to it
function linked(
  copy: { cents: number; store: string; url: string | null } | null | undefined,
  condition: "new" | "used",
  isbn: string,
): UsedOffer | null {
  if (!copy) return null;
  const url = affiliateOfferUrl({ ...copy, format: "print", condition }, isbn);
  if (!url) return null;
  return {
    cents: copy.cents,
    store: copy.store,
    url,
    affiliate: isAffiliateUrl(url),
  };
}
