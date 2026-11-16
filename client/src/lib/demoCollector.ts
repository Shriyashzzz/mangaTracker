// The collector tour's practice shelf: a real collection of forty series
// (demoCollector.json, built by server/scripts/demoCollectorShelf.ts), with
// each series' volumes in English by their real ISBNs, so the tour shows real
// covers, and its deluxe and omnibus books. What was paid and when is made up,
// as the tour's prices are. Loaded only when that tour starts.
import type { OwnedBook } from "./books";
import type { EditionLine } from "./editions";
import type { Manga } from "./types";

export type CollectorSeries = {
  id: number;
  name: string;
  genre: string;
  image: string | null;
  status: boolean;
  planned: boolean;
  bookmark: number | null;
  rating: number | null;
  edition: string | null;
  volumesOwned: number | null;
  ownedList: number[];
  // [volume, ISBN] for every volume known in English
  volumes: [number, string][];
  books: Omit<OwnedBook, "id">[];
  // its omnibus and deluxe lines, as the site has them
  editions: EditionLine[];
};

let loaded: CollectorSeries[] | null = null;
export async function loadCollector() {
  loaded ??= (await import("./demoCollector.json"))
    .default as unknown as CollectorSeries[];
  return loaded;
}

// the edition a series is collected in: the line its books are from, when
// they're deluxe or omnibus books
const collectedIn = (s: CollectorSeries) => {
  const kind = s.books.find((b) => b.edition !== "single")?.edition;
  return s.editions.find((line) => line.kind === kind)?.key ?? null;
};

export const collectorShelf = (all: CollectorSeries[]): Manga[] =>
  all.map((s) => ({
    id: s.id,
    userId: 0,
    name: s.name,
    genre: s.genre,
    image: s.image,
    description: null,
    status: s.status,
    planned: s.planned,
    lightNovel: false,
    bookmark: s.bookmark,
    // a collection imported without chapters keeps its place by volume,
    // at the last one owned, as a collector's shelf would
    ...(s.bookmark
      ? {}
      : {
          byVolume: true,
          readVolume: s.volumesOwned ?? Math.max(0, ...s.ownedList),
        }),
    rating: s.rating,
    // the edition its books are, over what the account had picked
    edition: collectedIn(s) ?? s.edition,
    volumesOwned: s.volumesOwned,
    ownedList: s.ownedList,
  }));

// the series a volume of the practice shelf belongs to, by its ISBN
export function collectorVolume(all: CollectorSeries[], isbn: string) {
  for (const series of all) {
    const found = series.volumes.find(([, i]) => i === isbn);
    if (found) return { series, volume: found[0] };
  }
  return null;
}

// its books, numbered as the server would
export const collectorBooks = (series: CollectorSeries): OwnedBook[] =>
  series.books.map((b, i) => ({ ...b, id: series.id * 1000 + i }));
