// What an "after the anime" page says about buying: each English volume
// that's out, with its cheapest saved new price at a store readers know.
// From the database only: nothing here looks a volume or a price up, so a
// search engine reading the page can't start a search.
//
// The page's words for it are in client/src/lib/afterAnimeText.ts (catchUp,
// priceLine): what's left after the anime, and what it costs.
import priceQueries, { type Country } from "../../models/priceQueries.js";
import { notOutYet } from "../preorder.js";
import { isWellKnown, shopName } from "../volumeNames.js";
import { volumesKey } from "../volumesKey.js";

// one volume that's out. Its price is null when none is saved
export type SavedBook = {
  volume: number;
  isbn13: string;
  cents: number | null;
  store: string | null;
  checkedAt: Date | null;
};

export async function savedBooksOf(
  seriesName: string,
  country: Country = "us",
): Promise<SavedBook[]> {
  const saved = await priceQueries.getSeriesVolumes(volumesKey(seriesName));
  // whole volumes that are out, each once (the first listed is the one the
  // series page shows)
  const out = new Map<number, string>();
  for (const book of saved?.volumes ?? []) {
    const isWhole = book.volume !== null && Number.isInteger(book.volume);
    if (!isWhole || out.has(book.volume!) || notOutYet(book.published))
      continue;
    out.set(book.volume!, book.isbn13.trim());
  }
  const copies = await priceQueries.getCheapestCopies(
    [...new Set(out.values())],
    isWellKnown,
    country,
  );
  return [...out]
    .sort(([a], [b]) => a - b)
    .map(([volume, isbn13]) => {
      const copy = copies.get(isbn13)?.new ?? null;
      return {
        volume,
        isbn13,
        cents: copy?.cents ?? null,
        store: copy ? shopName(copy.store) : null,
        checkedAt: copy?.checkedAt ?? null,
      };
    });
}
