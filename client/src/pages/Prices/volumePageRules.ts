// What a volume's price page works out from what it loaded: which offers and
// history show, the volumes around it, which stores get a link, and the
// series' usual price. Pure: no requests and no state.
import type {
  InBook,
  Offer,
  PriceHistory,
  SeriesVolume,
  StoreLink,
} from "../../lib/types";

// how many of the series' other volumes are listed
const SIBLINGS_SHOWN = 12;
// a volume not out yet gets a button for each of these (the affiliate
// stores), the first the main one; the other stores are links under them
const PREORDER_STORES = ["Amazon", "Bookshop.org", "eBay"];
// a usual price needs this many priced volumes to go by
const ENOUGH_FOR_USUAL = 3;
// the headline is "well above usual" from this many times the usual price
const WELL_ABOVE = 1.4;

// ---------- dates ----------

// "Oct 26, 2026"
export const shortDate = (date: string) =>
  new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

// "Oct 26", with the year only when it isn't this one
export function dayDate(text: string) {
  const date = new Date(text);
  const isThisYear = date.getFullYear() === new Date().getFullYear();
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    ...(!isThisYear && { year: "numeric" }),
  });
}

// "Mar 30, 2027" (or "Mar 2027" when only the month is known)
export function releaseDay(published: string) {
  const [year, month, day] = published.split("-").map(Number);
  return new Date(year!, (month || 1) - 1, day || 1).toLocaleDateString(
    "en-US",
    {
      month: "short",
      ...(day ? { day: "numeric" } : {}),
      year: "numeric",
    },
  );
}

// ---------- what shows ----------

// the offers the price list shows. Ebooks go when they've said they only
// want physical copies (Settings). A box set is another buy: off this list,
// and one line under it points to the series page, which has them. An
// omnibus holding this volume stays: it's another way to buy this volume
export function shownOffers(offers: Offer[], hideEbooks: boolean) {
  const shown = offers.filter((offer) => {
    if (hideEbooks && offer.format === "ebook") return false;
    return offer.format !== "set";
  });
  const hiddenEbooks = hideEbooks
    ? offers.filter((offer) => offer.format === "ebook").length
    : 0;
  return { shown, hiddenEbooks };
}

// the price history that shows, and the lowest it has been. The lowest is
// for a physical copy, like the rest of the page, unless only ebooks are
// recorded
export function shownHistory(
  history: PriceHistory | null,
  hideEbooks: boolean,
) {
  const kinds = (history?.kinds ?? []).filter(
    (kind) => !hideEbooks || kind.kind !== "ebook",
  );
  const printKinds = kinds.filter((kind) => kind.kind !== "ebook");
  const forTheLowest = printKinds.length ? printKinds : kinds;
  return {
    history: history && kinds.length ? { ...history, kinds } : null,
    lowestCents: Math.min(...forTheLowest.map((kind) => kind.lowCents)),
  };
}

// the series' other volumes to list under this one: the next ones first,
// then the ones before, nearest first. A book holding several counts as its
// last volume
export function nearbyVolumes(
  siblings: SeriesVolume[],
  volume: number | null,
  inBook: InBook | null,
) {
  const here = volume ?? inBook?.to ?? null;
  const after = siblings.filter((v) => here == null || (v.volume ?? 0) > here);
  const before = siblings
    .filter((v) => here != null && (v.volume ?? 0) < here)
    .reverse();
  return [...after, ...before].slice(0, SIBLINGS_SHOWN);
}

// one store's name inside the other's ("Amazon" and "Amazon.com")
const sameStore = (a: string, b: string) => {
  const one = a.toLowerCase();
  const other = b.toLowerCase();
  return one.includes(other) || other.includes(one);
};

// which stores get a link on the page.
//   buttons: a preorder's main buttons, in PREORDER_STORES order
//   others:  the stores with no row in the price list (a row would just be
//            repeated). A preorder shows no price list, so then every store
//            that isn't a button is listed. eBay stays either way, and goes
//            first: a row there is one seller, and many more may have it
export function storeLinksToShow(
  storeLinks: StoreLink[],
  offers: Offer[],
  isPreorder: boolean,
) {
  const buttons: StoreLink[] = [];
  if (isPreorder)
    for (const name of PREORDER_STORES) {
      const link = storeLinks.find((s) => s.store === name);
      if (link) buttons.push(link);
    }
  const isButton = (store: string) => buttons.some((s) => s.store === store);
  const hasOffer = (store: string) =>
    !isPreorder && offers.some((offer) => sameStore(offer.store, store));

  const ebay = storeLinks.filter(
    (s) => s.store === "eBay" && !isButton(s.store),
  );
  const rest = storeLinks.filter(
    (s) => s.store !== "eBay" && !hasOffer(s.store) && !isButton(s.store),
  );
  return { buttons, others: [...ebay, ...rest] };
}

// the series' usual new price, from its other volumes (the middle one), when
// the headline price is well above it: said beside the price, since it's a
// store's odd price and not what the book costs. Null otherwise
export function usualWhenWellBelow(
  siblings: SeriesVolume[],
  thisIsbn: string,
  headlineCents: number | undefined,
) {
  const others = siblings
    .filter((v) => v.isbn13 !== thisIsbn && v.knownPriceCents != null)
    .map((v) => v.knownPriceCents!)
    .sort((a, b) => a - b);
  if (others.length < ENOUGH_FOR_USUAL) return null;
  const usual = others[Math.floor(others.length / 2)]!;
  const isWellAbove =
    headlineCents !== undefined && headlineCents >= usual * WELL_ABOVE;
  return isWellAbove ? usual : null;
}
