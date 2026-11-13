// How a volume and its stores are named on the pages: a volume's heading and
// number from its title, and a seller's store by a name a reader knows.
// Small and shared by the price service's files, so none of them has to
// import another for it.
import { bookNumberOf, normalize, volumeOf } from "./stores/match.js";
import { isRetailer } from "./stores/retailers.js";
import { storeName } from "./stores/storeLinks.js";

const numberOrNull = (n: number) => (Number.isFinite(n) ? n : null);

// what a volume's page is called: its stored title, unless that has no volume
// number ("Dragon Ball Z; Thank You", "Hellsing") and its series list knows
// which volume it is, then "Dragon Ball Z, Vol. 24", so volumes of a series
// don't share one title. The address keeps the stored title, so it never moves
export const volumeHeading = (
  title: string,
  series: string,
  listed: { volume?: number | null; inBook?: unknown } | null | undefined,
) => {
  if (bookNumberOf(title) !== null || listed?.inBook) return title;
  const n = volumeOf(title);
  if (!Number.isFinite(n))
    return listed?.volume != null ? `${series}, Vol. ${listed.volume}` : title;
  // just the series and its number ("ONE PIECE 28", "Berserk 12"): said the
  // one way every page says it, "One Piece, Vol. 28". A title with more in it
  // (a subtitle, "Deluxe") keeps its own words
  const bare = title.replace(/[\s,.#]*(vol(ume)?\.?\s*)?\d+(\.\d+)?\s*$/i, "");
  return normalize(bare) === normalize(series) ? `${series}, Vol. ${n}` : title;
};
// the volume a title names: none for a book holding several ("Vinland Saga,
// Book 9" is vols 17 and 18, never vol 9)
export const titleVolume = (title: string) =>
  bookNumberOf(title) !== null ? null : numberOrNull(volumeOf(title));

// a seller on a big store ("eBay - pele-onfyah") goes by the store's name
export const shopName = (store: string) =>
  storeName(store.split(/\s[-–—|]\s/)[0]!.trim());
// a store a reader knows by name: the big ones, eBay and the ebook stores
export const isWellKnown = (store: string) =>
  isRetailer(shopName(store)) ||
  /^(ebay|google play( books)?|kobo(\.com)?|bookwalker|kindle)$/i.test(
    shopName(store),
  );
