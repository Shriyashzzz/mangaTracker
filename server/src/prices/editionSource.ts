// Where a series' edition lines come from, and where they're kept: one Open
// Library search for the series' omnibus and deluxe books, plus the books its
// own volume list already knows hold several (CatalogBook.inBook). Saved
// beside the series' other lists (series_volumes, ":editions") for a week;
// "has none" is an answer too.
import priceQueries from "../models/priceQueries.js";
import { openLibraryFetch } from "./sources/openLibrary.js";
import { volumesKey } from "./volumesKey.js";
import {
  buildEditionLines,
  type EditionDoc,
  type EditionLine,
} from "./editionLines.js";
import type { CatalogBook } from "./types.js";

const FRESH_MS = 7 * 24 * 60 * 60 * 1000;
// a failed search is asked again sooner
const RETRY_MS = 60 * 60 * 1000;
const TIMEOUT_MS = 8000;
const editionsKey = (name: string) => volumesKey(name) + ":editions";

type OpenLibraryDoc = {
  title?: string;
  isbn?: string[];
  publisher?: string[];
  number_of_pages_median?: number;
};

async function searchEditions(name: string): Promise<EditionDoc[]> {
  const url = new URL("https://openlibrary.org/search.json");
  const quoted = name.replace(/["\\]/g, " ");
  url.searchParams.set(
    "q",
    `title:"${quoted}" AND title:(omnibus OR deluxe OR edition OR vizbig OR "in-1" OR "in 1")`,
  );
  url.searchParams.set("fields", "title,isbn,publisher,number_of_pages_median");
  url.searchParams.set("limit", "100");
  const res = await openLibraryFetch(url, TIMEOUT_MS);
  if (!res.ok) throw new Error(`Open Library answered ${res.status}`);
  const { docs = [] } = (await res.json()) as { docs?: OpenLibraryDoc[] };
  return docs.flatMap((doc) => {
    // the US trade copy: a record lists every language's ISBNs together
    const isbn13 = doc.isbn?.find((i) => /^978[01]\d{9}$/.test(i));
    return doc.title && isbn13
      ? [
          {
            title: doc.title,
            isbn13,
            publishers: doc.publisher,
            pages: doc.number_of_pages_median ?? null,
          },
        ]
      : [];
  });
}

// the books a series' own list already knows hold several volumes, as
// records the builder reads: "Vinland Saga #17-18"
const docsFromVolumes = (name: string, volumes: CatalogBook[]) => {
  const seen = new Set<string>();
  return volumes.flatMap((v): EditionDoc[] => {
    if (!v.inBook || seen.has(v.isbn13)) return [];
    seen.add(v.isbn13);
    return [
      {
        title: `${name} #${v.inBook.from}-${v.inBook.to}`,
        isbn13: v.isbn13.trim(),
      },
    ];
  });
};

const inFlight = new Map<string, Promise<EditionLine[]>>();

// a series' edition lines. `volumes`: its own list (getSeries), for the last
// volume out and the books it already knows hold several
export async function editionLinesOf(
  name: string,
  volumes: CatalogBook[],
  // false: only what's saved, never a search (a crawler's visit)
  lookUp = true,
): Promise<EditionLine[]> {
  const key = editionsKey(name);
  const saved = await priceQueries.getSeriesVolumes(key).catch(() => null);
  const lines = (saved?.volumes ?? null) as unknown as
    EditionLine[] | { failed: true }[] | null;
  const failed = Boolean(lines?.length && "failed" in lines[0]!);
  if (saved && Date.now() - saved.at < (failed ? RETRY_MS : FRESH_MS))
    return failed ? [] : (lines as EditionLine[]);
  // old or missing, and not to be looked up: what's saved, however old
  if (!lookUp) return failed || !lines ? [] : (lines as EditionLine[]);
  const running = inFlight.get(key);
  if (running) return running;
  const numbers = volumes
    .map((v) => v.volume)
    .filter((v): v is number => v != null && Number.isInteger(v));
  const total = numbers.length ? Math.max(...numbers) : null;
  const build = (async () => {
    try {
      const docs = await searchEditions(name);
      const built = buildEditionLines(
        name,
        [...docs, ...docsFromVolumes(name, volumes)],
        total,
      );
      await priceQueries
        .saveSeriesVolumes(key, built as unknown as CatalogBook[])
        .catch(() => {});
      return built;
    } catch {
      // what its own list says is still worth showing; asked again in an hour
      await priceQueries
        .saveSeriesVolumes(key, [{ failed: true }] as unknown as CatalogBook[])
        .catch(() => {});
      return buildEditionLines(name, docsFromVolumes(name, volumes), total);
    } finally {
      inFlight.delete(key);
    }
  })();
  inFlight.set(key, build);
  return build;
}
