// Which "new" copies we believe. Anyone can list on Google Shopping, and a
// few sellers post a new copy at a price no real store could match (a
// cosmetics shop "sold" Dandadan Vol. 8 new for $4). Those listings are
// dropped: they'd otherwise take the "Lowest price" stamp, the headline
// price and the price history.
//
// Big stores are always believed. Everyone else (plenty of real comic
// shops and indie bookstores among them) is believed unless the price is
// far below a yardstick: what the big stores charge in the same check;
// failing that, this volume's usual new price so far; failing both, a floor
// no new English volume goes under.
//
// Overpriced ones go too: a fashion site "sold" One Piece Vol. 1 new for $42, and
// that became the headline on a $10 book. An unknown seller's new copy goes if it's
// far above the big stores, or failing that, the other copies in the same check. With
// nothing to compare it to, only a price over a normal volume's range goes.
import type { Offer } from "../types.js";

// a store name reduced to lowercase words: "Books-A-Million" -> "books a million"
const key = (store: string) =>
  store
    .toLowerCase()
    .replace(/\.(com|org|net|co\.uk|ca)\b/g, "")
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9&]+/g, " ")
    .trim();

const RETAILERS = new Set([
  "amazon",
  "barnes & noble",
  "barnes and noble",
  "barnesandnoble",
  "walmart",
  "target",
  "books a million",
  "bookshop",
  "crunchyroll",
  "crunchyroll store",
  "right stuf",
  "right stuf anime",
  "kinokuniya",
  "kinokuniya usa",
  "books kinokuniya",
  "powells",
  "powells books",
  "indigo",
  "hudson booksellers",
  "gamestop",
  "costco",
  "sams club",
  "midtown comics",
  "things from another world",
  "forbidden planet",
  "blackwells",
  "wordery",
  "viz",
  "viz media",
  "simon & schuster",
  "simon and schuster",
  "penguin random house",
  "kodansha",
]);

// any single volume, deluxe editions included, sits inside this. It catches
// bad listings even when there are too few to compare with each other
export const plausiblePrice = (cents: number) => cents >= 200 && cents <= 7500;

// resale sites where listings are mostly used copies from individual sellers
const RESALE =
  /\b(ebay|poshmark|mercari|etsy|tiktok|abebooks|thriftbooks|depop|facebook|offerup|alibris|biblio|whatnot|world of books|wob|half price books|better world books)\b/i;
export const isResaleSite = (store: string) => RESALE.test(store);

// sellers whose listings aren't an English printed volume at all
const NOT_A_BOOK = /\baudiobooks?\b|\bcdjapan\b/i;
export const isNotABook = (store: string) => NOT_A_BOOK.test(store);

// third-party sellers on a big store: "Walmart - Some Seller"
const SELLER_SUFFIX = /\s[-–—|]\s/;

export const isRetailer = (store: string) =>
  !SELLER_SUFFIX.test(store) && RETAILERS.has(key(store));

// an unknown seller's new copy below this share of the yardstick isn't
// believed
const MIN_SHARE = 0.6;
// the yardstick with no big store and no history: English volumes list at
// $9.99 and up, and real discounts stop well above this
const MIN_UNKNOWN_CENTS = 600;

// how far above the yardstick an unknown seller's new copy can go. Deluxe editions
// survive this, since every other copy of one costs about the same
const MAX_TIMES = 2.2;
// the other copies needed before they can stand in for a big store's price
const MIN_TO_COMPARE = 2;
// with no big store to go by, a new copy over this has to be vouched for by the others
const MAX_NORMAL_CENTS = 3500;

const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]!
    : (sorted[middle - 1]! + sorted[middle]!) / 2;
};

const isNewPrint = (o: Offer) => o.condition === "new" && o.format === "print";

// for one check's offers: whether a given offer is a new copy we don't believe, for
// being too cheap or too dear. `usualCents` is the volume's median new price from
// earlier checks. It's only used against low prices: a $42 listing's own history
// would otherwise vouch for it
export function unlikelyNewTest(offers: Offer[], usualCents?: number | null) {
  const bigStore = offers
    .filter((o) => isNewPrint(o) && isRetailer(o.store))
    .map((o) => o.priceCents);
  const floor = bigStore.length
    ? Math.min(...bigStore) * MIN_SHARE
    : usualCents
      ? usualCents * MIN_SHARE
      : MIN_UNKNOWN_CENTS;
  const tooDear = (o: Offer) => {
    if (bigStore.length) return o.priceCents > Math.min(...bigStore) * MAX_TIMES;
    // a normal volume's price is fine, however cheap the used copies are
    if (o.priceCents <= MAX_NORMAL_CENTS) return false;
    const others = offers
      .filter((other) => other !== o && other.format === "print")
      .map((other) => other.priceCents);
    return others.length < MIN_TO_COMPARE || o.priceCents > median(others) * MAX_TIMES;
  };
  return (o: Offer) =>
    isNewPrint(o) &&
    !isRetailer(o.store) &&
    (o.priceCents < floor || tooDear(o));
}

// the lowest new print copy in one check that we believe
export function lowestBelievableNew<T extends Offer>(
  offers: T[],
  usualCents?: number | null,
) {
  const prices = dropUnlikelyNew(offers, usualCents)
    .filter(isNewPrint)
    .map((o) => o.priceCents);
  return prices.length ? Math.min(...prices) : null;
}

// one check's offers without the new copies we don't believe
export function dropUnlikelyNew<T extends Offer>(
  offers: T[],
  usualCents?: number | null,
): T[] {
  const unlikely = unlikelyNewTest(offers, usualCents);
  return offers.filter((o) => !unlikely(o));
}
