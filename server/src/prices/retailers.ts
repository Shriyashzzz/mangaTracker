// Which "new" copies we believe. Anyone can list on Google Shopping, and a
// few sellers post a new copy at a price no real store could match (a
// cosmetics shop "sold" Dandadan Vol. 8 new for $4). Those listings are
// dropped: they'd otherwise take the "Lowest price" stamp, the headline
// price and the price history.
//
// Big stores are always believed. Everyone else (plenty of real comic
// shops and indie bookstores among them) is believed unless the price is
// far below what the big stores charge in the same check, or below a
// floor no new English volume goes under when no big store answered.
import type { Offer } from "./types.js";

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

// an unknown seller's new copy below this share of the big stores' price
// isn't believed
const MIN_SHARE = 0.6;
// and with no big store to compare against: English volumes list at $9.99
// and up, and real discounts stop well above this
const MIN_UNKNOWN_CENTS = 600;

const isNewPrint = (o: Offer) => o.condition === "new" && o.format === "print";

// for one check's offers: whether a given offer is a new copy we don't believe
export function unlikelyNewTest(offers: Offer[]) {
  const bigStore = offers
    .filter((o) => isNewPrint(o) && isRetailer(o.store))
    .map((o) => o.priceCents);
  const floor = bigStore.length
    ? Math.min(...bigStore) * MIN_SHARE
    : MIN_UNKNOWN_CENTS;
  return (o: Offer) =>
    isNewPrint(o) && !isRetailer(o.store) && o.priceCents < floor;
}

// one check's offers without the new copies we don't believe
export function dropUnlikelyNew<T extends Offer>(offers: T[]): T[] {
  const unlikely = unlikelyNewTest(offers);
  return offers.filter((o) => !unlikely(o));
}
