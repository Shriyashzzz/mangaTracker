// What a season's panel needs to send someone straight to a store: each
// volume's cheapest new copy in stock at a store readers know by name, as
// last saved, with the store's link (ours, where we have an affiliate tag)
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

// by ISBN; a volume with no saved price, or no link to its store, isn't in it
export async function buyOffers(isbns: string[]) {
  const [copies, known] = await Promise.all([
    priceQueries.getCheapestCopies(isbns, isWellKnown),
    priceQueries.getKnownPrices(isbns),
  ]);
  const offers: Record<string, BuyOffer> = {};
  for (const isbn of isbns) {
    const cheapest = copies.get(isbn)?.new;
    const checkedAt = known.get(isbn)?.checkedAt;
    if (!cheapest || !checkedAt) continue;
    const url = affiliateOfferUrl(
      { ...cheapest, format: "print", condition: "new" },
      isbn,
    );
    if (!url) continue;
    offers[isbn] = {
      cents: cheapest.cents,
      store: cheapest.store,
      url,
      affiliate: isAffiliateUrl(url),
      checkedAt,
    };
  }
  return offers;
}
