// Which catalog books can be a series' single volumes (seriesService.ts
// mergeIntoOneList). Two catalog answers that look like a single but aren't:
//
// - A lone volume one of the series' saved edition lines holds. Vagabond's
//   Definitive 8 is titled plainly "Vagabond, Vol. 8" in the catalog, so it
//   passed as the single vol. 8; its edition line knows it by ISBN. The
//   singles list and the editions never claim the same book.
// - A volume answered for a gap (seriesService.ts gapVolumes) dated after the
//   series' later volumes: a reissue, not the single. A vol. 8 dated 2027
//   when vols. 9 to 37 were out by 2014 isn't the 2004 book. Like
//   preorder.ts withoutReprintDates, for the book rather than its date.
import type { CatalogBook } from "./types.js";

// the ISBNs a series' saved edition lines hold (series_volumes, editionsKey)
export function editionIsbnsOf(saved: unknown): Set<string> {
  const lines = Array.isArray(saved) ? saved : [];
  const isbns = new Set<string>();
  for (const line of lines as { books?: { isbn13?: string | null }[] }[])
    for (const book of line?.books ?? [])
      if (book?.isbn13) isbns.add(book.isbn13.trim());
  return isbns;
}

// a lone volume an edition line holds is the edition's, not a single. A book
// holding several volumes (Vinland Saga's 2-in-1 hardcovers, `inBook`) is the
// series' own English book and its edition line's alike: kept
export const editionsOwn = (
  isbns: Set<string>,
  book: Pick<CatalogBook, "isbn13" | "inBook">,
) => !book.inBook && isbns.has(book.isbn13.trim());

// a gap's answer dated after every later volume with a year: at least two
// of them, so one odd date proves nothing
export function reissueOfOldVolume(
  book: Pick<CatalogBook, "volume" | "year">,
  byNumber: Map<number | null, Pick<CatalogBook, "year">>,
) {
  if (book.volume == null || !book.year) return false;
  const later = [...byNumber.entries()]
    .filter(([n, b]) => n != null && n > book.volume! && b.year)
    .map(([, b]) => b.year!);
  return later.length >= 2 && book.year > Math.max(...later);
}
