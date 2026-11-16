// A manga page that picked up its light novel's volumes. Accel World's manga
// is 8 volumes; the novels carry the same title ("Accel World, Vol. 12"), so
// merged by number the manga's list ran on to 27. Vampire Hunter D and
// Torture Princess did the same.
//
// Only on strong evidence:
//   - a finished manga, with the count of volumes AniList gives (N)
//   - three or more volumes listed past N (one or two are strays, which
//     withoutStraysPastTheEnd drops on its own)
//   - the series has a light novel we know of (its own saved list)
// Then the volumes past N go, and so does any book that's on the novel's
// own list. A long run past the count with no novel behind it (Shaman King:
// Kodansha's 35 against AniList's 32) is another numbering, and stays.
import type { CatalogBook } from "./types.js";

type Listed = CatalogBook & { volume: number };

// how many past the end make a run, not strays
export const RUN_PAST_THE_END = 3;

const isLoneVolume = (book: CatalogBook) =>
  !book.inBook && book.volume != null && Number.isInteger(book.volume);

// the finished manga's count, when the list runs on past it far enough to
// need the novel's list (asked before reading it, so most pages never do)
export function runsPastItsEnd(listed: Listed[], finishedWith: number | null) {
  if (!finishedWith) return false;
  const past = listed.filter((v) => isLoneVolume(v) && v.volume > finishedWith);
  return past.length >= RUN_PAST_THE_END;
}

export function withoutTheNovels(
  listed: Listed[],
  // AniList's count for a finished manga; null otherwise
  finishedWith: number | null,
  // every ISBN on the series' light novel's saved lists; none when it has no
  // novel we know of
  novelIsbns: Set<string>,
): Listed[] {
  if (!novelIsbns.size || !runsPastItsEnd(listed, finishedWith)) return listed;
  return listed.filter(
    (v) =>
      !isLoneVolume(v) ||
      (v.volume <= finishedWith! && !novelIsbns.has(v.isbn13.trim())),
  );
}
