// The English cover of a series: its first US volume's. A series' own cover
// is AniList's, which is the Japanese edition's, so a page that asks for a
// series cover by name gets the US one where we know it (the cover route
// /cover/series, in pricesController.ts).
//
// "Know it" means one of two things we already hold, tried in this order:
//
//   1. the series' saved volume list (series_volumes, filled the first
//      time someone opens its price page)
//   2. the books we've stored for it (books, grouped by series in
//      shelfService.ts knownVolumesBySeries): a series can have priced
//      volumes without a saved list
//
// Nothing is looked up in a catalog here: a list of 50 covers must not
// start 50 searches. A series with neither shows its Japanese cover until
// its price page is opened, or scripts/saveEnglishCovers.ts is run, which
// saves the list for every series that's missing one.
import priceQueries from "../../models/priceQueries.js";
import { knownVolumesBySeries } from "../shelfService.js";
import { seriesName, slugify } from "../stores/match.js";
import type { CatalogBook } from "../types.js";
import { titleVolume } from "../volumeNames.js";
import { volumesKey } from "../volumesKey.js";

// The ISBN of volume 1, as a book of its own. Not a book holding several
// volumes ("3-in-1", listed with `inBook`): its cover is the omnibus's
export function firstVolumeIsbn(volumes: CatalogBook[]): string | null {
  const first = volumes.find((v) => v.volume === 1 && !v.inBook);
  return first?.isbn13.trim() ?? null;
}

// The same from the stored books: the one titled "…, Vol. 1". Stored under
// the series' name as typed, or as its titles carry it
async function storedFirstVolumeIsbn(name: string): Promise<string | null> {
  const bySeries = await knownVolumesBySeries();
  for (const slug of new Set([slugify(name), slugify(seriesName(name))])) {
    for (const book of bySeries.get(slug)?.values() ?? []) {
      if (titleVolume(book.title) === 1) return book.isbn13.trim();
    }
  }
  return null;
}

// name -> ISBN (or null: none known), remembered a while so a page of
// covers reads the database once per series. Capped, oldest out first
const REMEMBER_MS = 10 * 60 * 1000;
const REMEMBER_MAX = 5_000;
const remembered = new Map<string, { isbn: string | null; at: number }>();

export async function englishCoverIsbn(name: string): Promise<string | null> {
  const key = volumesKey(name);
  const hit = remembered.get(key);
  if (hit && Date.now() - hit.at < REMEMBER_MS) return hit.isbn;
  const saved = await priceQueries.getSeriesVolumes(key);
  const isbn =
    (saved && firstVolumeIsbn(saved.volumes)) ??
    (await storedFirstVolumeIsbn(name));
  remembered.set(key, { isbn, at: Date.now() });
  if (remembered.size > REMEMBER_MAX)
    remembered.delete(remembered.keys().next().value!);
  return isbn;
}
