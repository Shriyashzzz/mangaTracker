// What a shared shelf can say about a series' volumes beyond which ones its
// owner has: the next one to get (the page's "To get" tab, a gift list of
// sorts), and whether they have every volume that's out (the page counts
// those). Worked out from the series lists the price pages have saved
// (collector/shelfSeries.ts): database only, so a series nobody has opened a
// price page for just has neither.
import type { ListedVolume } from "../../collector/shelfMath.js";
import { notOutYet } from "../../prices/preorder.js";

export type NextVolume = {
  volume: number;
  // its price page
  isbn13: string;
  title: string;
  // its release date ("2027-06-08"), when it isn't out yet
  comingOut: string | null;
  // the best new price we know for it, in cents: "from $8.99". Filled in
  // by the route, from the prices on file (never a new search)
  fromCents?: number | null;
};

export type VolumeFacts = { next: NextVolume | null; ownsAll: boolean };

const NONE: VolumeFacts = { next: null, ownsAll: false };

// `owned`: the numbers of the volumes they have. `listed`: the series'
// volumes as the catalog knows them
export function volumeFacts(
  owned: number[],
  listed: ListedVolume[],
  now = new Date(),
): VolumeFacts {
  const highest = Math.floor(Math.max(0, ...owned));
  if (!highest || !listed.length) return NONE;
  const numbered = listed.filter(
    (v): v is ListedVolume & { volume: number } => v.volume !== null,
  );
  const isOut = (v: ListedVolume) => notOutYet(v.published, now) === null;
  const newestOut = Math.max(0, ...numbered.filter(isOut).map((v) => v.volume));

  // the one right after their highest, and only that one: where the catalog
  // has a hole, naming a later volume as "next" would be wrong
  const book = numbered.find((v) => v.volume === highest + 1);
  const next = book
    ? {
        volume: book.volume,
        isbn13: book.isbn13,
        title: book.title,
        comingOut: notOutYet(book.published, now),
      }
    : null;

  // every volume from 1 to the newest one out, no gaps
  const has = new Set(owned.map(Math.floor));
  let ownsAll = newestOut > 0;
  for (let n = 1; n <= newestOut && ownsAll; n++) ownsAll = has.has(n);
  return { next, ownsAll };
}
