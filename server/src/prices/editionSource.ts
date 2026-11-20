// Where a series' edition lines come from, and where they're kept: one Open
// Library search for the series' omnibus and deluxe books, plus the books its
// own volume list already knows hold several (CatalogBook.inBook). Saved
// beside the series' other lists (series_volumes, ":editions") for a week;
// "has none" is an answer too.
import { prisma } from "../config/prisma.js";
import priceQueries from "../models/priceQueries.js";
import { slugify } from "./stores/match.js";
import { openLibraryFetch } from "./sources/openLibrary.js";
import { bamEditionBooks } from "./providers/booksAMillion.js";
import {
  googleEditionBooks,
  googleLookupsPaused,
} from "./sources/googleBooksCatalog.js";
import { isJapaneseTitle, ownTitleOf } from "./sources/catalog.js";
import { volumesKey } from "./volumesKey.js";
import {
  buildEditionLines,
  TRADE_ISBN,
  type EditionDoc,
  type EditionLine,
} from "./editionLines.js";
import type { CatalogBook } from "./types.js";

const FRESH_MS = 7 * 24 * 60 * 60 * 1000;
// a failed search is asked again sooner
const RETRY_MS = 60 * 60 * 1000;
const TIMEOUT_MS = 8000;
// when the rules for building lines last changed (the one list of editions,
// Definitive and the rest; own titles for Japanese-filed books): a list saved
// before then is built again, whatever its age
// (2026-11-20: no guessed short book past the last one found, so Vagabond's
// VIZBIGs end at 12). Always a moment already past: a time still to come
// would make every save old the instant it's made, and ask without end
const RULES_FROM = Date.UTC(2026, 10, 20, 4);
export const editionsKey = (name: string) => volumesKey(name) + ":editions";
// Saved beside a series' lines when they were built while a catalog wasn't
// answering (Google's day used up): the lines are used, by the series' page
// and the shelf alike, but asked about again an hour on. Gone once a whole
// answer comes
export const halfAnswerKey = (name: string) => editionsKey(name) + ":half";

// whether lines saved at `savedAt` can still be used as they are: built by
// today's rules, and not a week old; and if they're a half answer (saved at
// `halfAt`), not an hour old. The background job asks about the rest
// (collector/editionFiller.ts)
export const editionLinesFresh = (
  savedAt: number,
  now = Date.now(),
  halfAt: number | null = null,
) =>
  savedAt >= RULES_FROM &&
  now - savedAt < FRESH_MS &&
  (halfAt == null || now - halfAt < RETRY_MS);

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
    const isbn13 = doc.isbn?.find((i) => TRADE_ISBN.test(i));
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

// The records a search filed under a Japanese title, each given the English
// title of its own record (catalog.ts ownTitleOf). null when there are none,
// so nothing is saved again. At most MOST_OWN_TITLES, three at a time: Open
// Library is shared and free
const MOST_OWN_TITLES = 45;
async function withOwnTitles(docs: EditionDoc[]): Promise<EditionDoc[] | null> {
  const filed = docs
    .filter((doc) => isJapaneseTitle(doc.title))
    .slice(0, MOST_OWN_TITLES);
  if (!filed.length) return null;
  const titles = new Map<string, string>();
  for (let i = 0; i < filed.length; i += 3)
    await Promise.all(
      filed.slice(i, i + 3).map(async (doc) => {
        const title = await ownTitleOf(doc.isbn13);
        if (title) titles.set(doc.isbn13, title);
      }),
    );
  if (!titles.size) return null;
  return docs.map((doc) =>
    titles.has(doc.isbn13) ? { ...doc, title: titles.get(doc.isbn13)! } : doc,
  );
}

// the last volume out, as the series' own list has it; null when it has none
function lastVolumeOf(volumes: CatalogBook[]) {
  const numbers = volumes
    .map((v) => v.volume)
    .filter((v): v is number => v != null && Number.isInteger(v));
  return numbers.length ? Math.max(...numbers) : null;
}

// who wrote the series, as it's saved from AniList; none when it isn't saved
async function savedAuthorsOf(name: string) {
  const saved = await prisma.seriesInfo
    .findUnique({ where: { slug: slugify(name) }, select: { info: true } })
    .catch(() => null);
  return (saved?.info as { authors?: string[] } | null)?.authors ?? [];
}

// A series' edition lines, asked for afresh: Open Library's records and
// Google Books' (publishers' own, with what each book holds and the day it
// came out), and the books the series' own list knows hold several. Nothing
// is read from or saved to the database, so a script can call it too
// (scripts/checkEditions.ts). Throws only when neither catalog answered
export async function findEditionLines(
  name: string,
  volumes: CatalogBook[],
  // the series' authors, where known: Google's search is narrowed to them
  authors: string[] = [],
  // also ask Books-A-Million's shelf, one of the day's CJ calls: the
  // background job does, a page never (bamEditionBooks says why)
  askTheStore = false,
) {
  const [fromOpenLibrary, fromGoogle, fromStore] = await Promise.allSettled([
    searchEditions(name),
    googleEditionBooks(name, authors),
    askTheStore ? bamEditionBooks(name) : Promise.resolve([]),
  ]);
  const store: EditionDoc[] =
    fromStore.status === "fulfilled" ? fromStore.value : [];
  if (fromOpenLibrary.status === "rejected" && fromGoogle.status === "rejected")
    throw fromOpenLibrary.reason;
  const docs =
    fromOpenLibrary.status === "fulfilled" ? fromOpenLibrary.value : [];
  const google: EditionDoc[] =
    fromGoogle.status === "fulfilled" ? fromGoogle.value.books : [];
  const lines = buildEditionLines(
    name,
    [...docs, ...google, ...store, ...docsFromVolumes(name, volumes)],
    lastVolumeOf(volumes),
  );
  return {
    lines,
    docs,
    // (the store's with Google's: both are kept for the rebuild that
    // follows the books filed under Japanese titles)
    google: [...google, ...store],
    // which catalogs answered: an edition can't be called missing on the
    // word of one that didn't
    answered: {
      openLibrary: fromOpenLibrary.status === "fulfilled",
      // (a search that timed out or failed leaves holes too, not only a
      // day used up)
      google:
        fromGoogle.status === "fulfilled" &&
        fromGoogle.value.whole &&
        !googleLookupsPaused(),
      store: !askTheStore || fromStore.status === "fulfilled",
    },
  };
}

const inFlight = new Map<string, Promise<EditionLine[]>>();
// lines built while a catalog wasn't answering, by key: used for an hour
// in place of asking again, and never saved (editionLinesOf)

// a series' edition lines. `volumes`: its own list (getSeries), for the last
// volume out and the books it already knows hold several
export async function editionLinesOf(
  name: string,
  volumes: CatalogBook[],
  // false: only what's saved, never a search (a crawler's visit)
  lookUp = true,
  // the background job's lookup: Books-A-Million's shelf is asked too
  askTheStore = false,
): Promise<EditionLine[]> {
  const key = editionsKey(name);
  const halfKey = halfAnswerKey(name);
  const [saved, half] = await Promise.all([
    priceQueries.getSeriesVolumes(key).catch(() => null),
    priceQueries.getSeriesVolumes(halfKey).catch(() => null),
  ]);
  const lines = (saved?.volumes ?? null) as unknown as
    EditionLine[] | { failed: true }[] | null;
  const failed = Boolean(lines?.length && "failed" in lines[0]!);
  // lines saved before the rules last changed (more editions, books filed
  // under Japanese titles) are old whatever their age: built again
  // the marker says a whole answer was kept over a half one (written below)
  const keptWhole = Boolean(
    (half?.volumes as unknown as { whole?: boolean }[] | undefined)?.[0]?.whole,
  );
  // A whole answer kept through an outage waits the hour too, however old
  // it is: otherwise every visit to the page would ask again
  const wholeWaiting =
    keptWhole && half !== null && Date.now() - half.at < RETRY_MS;
  const fresh = failed
    ? saved !== null &&
      saved.at >= RULES_FROM &&
      Date.now() - saved.at < RETRY_MS
    : saved !== null &&
      (wholeWaiting || editionLinesFresh(saved.at, Date.now(), half?.at));
  if (fresh) return failed ? [] : (lines as EditionLine[]);
  // old or missing, and not to be looked up: what's saved, however old
  if (!lookUp) return failed || !lines ? [] : (lines as EditionLine[]);
  const running = inFlight.get(key);
  if (running) return running;
  const build = (async () => {
    try {
      const {
        lines: built,
        docs,
        google,
        answered,
      } = await findEditionLines(
        name,
        volumes,
        await savedAuthorsOf(name),
        askTheStore,
      );
      // A catalog that didn't answer (Google's day used up, Open Library
      // slow) leaves lines with holes in them. They're saved, so the shelf
      // and the series' page show the same, with a marker to ask again in
      // an hour. A whole answer saved before is better than a half one: it
      // stays, and is asked about again in an hour too
      const everyoneAnswered = answered.openLibrary && answered.google;
      // the lines saved are a whole answer: none marked, or the marker says
      // a whole one was kept
      const hadWhole =
        !failed &&
        Boolean(lines?.length) &&
        saved !== null &&
        (!half || keptWhole);
      if (!everyoneAnswered) {
        if (!hadWhole)
          await priceQueries
            .saveSeriesVolumes(key, built as unknown as CatalogBook[])
            .catch(() => {});
        // the marker: ask again in an hour, and whether what's saved is
        // the half answer or a whole one kept over it
        const marker = hadWhole ? [{ whole: true }] : [];
        await priceQueries
          .saveSeriesVolumes(halfKey, marker as unknown as CatalogBook[])
          .catch(() => {});
        return hadWhole ? (lines as EditionLine[]) : built;
      }
      await priceQueries
        .saveSeriesVolumes(key, built as unknown as CatalogBook[])
        .catch(() => {});
      await priceQueries.forgetSeriesVolumes(halfKey).catch(() => {});
      // books filed under the series' Japanese title ("鋼の錬金術師 1-3" for
      // the Fullmetal Alchemist 3-in-1): their own records have the English
      // one. Read behind this answer, a few at a time, and the lines saved
      // again with them, so the next ask has those editions too
      void withOwnTitles(docs)
        .then((named) => {
          if (!named) return;
          const fuller = buildEditionLines(
            name,
            [...named, ...google, ...docsFromVolumes(name, volumes)],
            lastVolumeOf(volumes),
          );
          return priceQueries.saveSeriesVolumes(
            key,
            fuller as unknown as CatalogBook[],
          );
        })
        .catch(() => {});
      return built;
    } catch {
      // what its own list says is still worth showing; asked again in an hour
      await priceQueries
        .saveSeriesVolumes(key, [{ failed: true }] as unknown as CatalogBook[])
        .catch(() => {});
      return buildEditionLines(
        name,
        docsFromVolumes(name, volumes),
        lastVolumeOf(volumes),
      );
    } finally {
      inFlight.delete(key);
    }
  })();
  inFlight.set(key, build);
  return build;
}
