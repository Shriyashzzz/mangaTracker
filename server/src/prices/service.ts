// The price checker's brain. Controllers call these; these call the
// catalog (Open Library), AniList, the price providers and the database.
//
//   getVolumePrices   one volume's page: offers, history, series, siblings
//   getSeries         one series' page: every US volume with known prices
//   getHighlights     the home page: trending, deals, recently checked
//   getShelfPrices    cheapest known price per manga on someone's shelf
//   getSeriesIndex    the /series page
//   get*Summary       database-only data for link previews and crawlers
//
// Only opening a volume page can spend a paid search, and at most once per
// volume every FRESH_FOR_MS; everything else reads what's already stored.
import priceQueries, { type Book } from "../models/priceQueries.js";
import { lookupIsbn, searchVolumesDetailed } from "./sources/catalog.js";
import {
  getSeriesInfo,
  getTrending,
  knownSeriesName,
  knownSeriesNames,
  listKnownSeries,
  searchSeries,
} from "./sources/anilist.js";
import {
  isNovelBook,
  isSingleVolume,
  normalize,
  seriesName,
  seriesOf,
  slugify,
  volumeOf,
  bookNumberOf,
  omnibusVolumes,
} from "./stores/match.js";
import { enabledProviders } from "./providers/index.js";
import { SearchesUsedUp } from "./providers/serpapiKeys.js";
import {
  affiliateOfferUrl,
  isAffiliateUrl,
  preferDirectRows,
  storeLinks,
} from "./stores/storeLinks.js";
import { editionCoverId } from "./sources/covers.js";
import { dropUnlikelyNew } from "./stores/retailers.js";
import { baseName, isNovelName, novelName } from "./lightNovel.js";
import { volumesKey } from "./volumesKey.js";
import type { CatalogBook, Offer, SeriesHit, SeriesInfo } from "./types.js";
import { googleSeriesVolumes } from "./sources/googleBooksCatalog.js";
import { notOutYet } from "./preorder.js";

export { searchSeries };

// prices are re-fetched at most this often per volume; in between, people
// see the stored ones. 20 days: volume prices move slowly, every page offers
// several stores, and the free SerpApi allowance runs out in days at less
const FRESH_FOR_MS = 20 * 24 * 60 * 60 * 1000;
const PROVIDER_TIMEOUT_MS = 12000;

const numberOrNull = (n: number) => (Number.isFinite(n) ? n : null);
// the volume a title names: none for a book holding several ("Vinland Saga,
// Book 9" is vols 17 and 18, never vol 9)
const titleVolume = (title: string) =>
  bookNumberOf(title) !== null ? null : numberOrNull(volumeOf(title));

// ---------- one volume ----------

// one fetch per ISBN at a time, even if several people open it at once
const inFlight = new Map<string, Promise<unknown>>();

// asks every enabled provider at once; one failing doesn't stop the others
// Google Shopping (one paid search covering many stores) is asked only when
// the stores asked directly found no print copy: most checks then spend one
// paid search fewer. Ebooks don't count, Google Play only has those
export const GOOGLE_SHOPPING = "serpapi";
export const needsGoogleShopping = (offers: Pick<Offer, "format">[]) =>
  !offers.some((o) => o.format === "print");

async function fetchAllProviders(isbn13: string, book: Book) {
  const enabled = enabledProviders();
  const first = enabled.filter((p) => p.id !== GOOGLE_SHOPPING);
  const fallback = enabled.filter((p) => p.id === GOOGLE_SHOPPING);
  const providers = [...first];
  const offers: Offer[] = [];
  const sources: string[] = [];
  let usedUp = false;

  const ask = async (list: typeof enabled) => {
    const results = await Promise.allSettled(
      list.map((p) =>
        p.fetchOffers(isbn13, AbortSignal.timeout(PROVIDER_TIMEOUT_MS), book),
      ),
    );
    results.forEach((r, i) => {
      const provider = list[i]!;
      if (r.status === "fulfilled") {
        sources.push(provider.id);
        offers.push(...r.value);
      } else if (r.reason instanceof SearchesUsedUp) {
        usedUp = true;
      } else {
        console.error(`price provider ${provider.id} failed:`, r.reason);
      }
    });
  };
  await ask(first);
  if (fallback.length && needsGoogleShopping(offers)) {
    providers.push(...fallback);
    await ask(fallback);
  }

  // with no searches left and no store answering, a new check would hide the
  // stored prices behind whatever's left (ebooks at most), so keep the old one
  if (usedUp && !sources.some((id) => id.startsWith("serpapi"))) {
    console.warn("SerpApi searches used up, showing the stored prices");
    return;
  }

  // only record a check if at least one source answered, so an outage
  // doesn't leave a volume looking "checked, nothing found" for 20 days
  if (providers.length && sources.length) {
    // judged against this volume's own usual new price before storing, so
    // a fake bargain never reaches the history
    const usual = await priceQueries.getNewPriceMedian(isbn13);
    await priceQueries.saveCheck(
      isbn13,
      sources,
      dropUnlikelyNew(preferDirectRows(offers), usual),
    );
  }
}

// the last check, when it's still the latest: no need to read it again
async function refreshIfStale(isbn13: string, book: Book) {
  const last = await priceQueries.getLastCheck(isbn13);
  const fresh = last && Date.now() - last.checkedAt.getTime() < FRESH_FOR_MS;
  if (fresh || !enabledProviders().length) return { unchanged: last };

  if (!inFlight.has(isbn13)) {
    inFlight.set(
      isbn13,
      fetchAllProviders(isbn13, book).finally(() => inFlight.delete(isbn13)),
    );
  }
  await inFlight.get(isbn13);
  // refreshed: the caller reads the new check
  return null;
}

// the stored book, or the catalog's answer stored for next time. A series
// list that holds this ISBN has the last word on its name and format: it saw
// the English edition (where the ISBN's own record can be Japanese) and told
// the novel from the manga by length. A book stored under the other format is
// renamed to match
async function getOrCreateBook(isbn13: string) {
  const [stored, saved] = await Promise.all([
    priceQueries.getBook(isbn13),
    priceQueries.getSavedVolume(isbn13).catch(() => null),
  ]);
  if (
    stored &&
    saved &&
    (isNovelBook(saved.title) !== isNovelBook(stored.title) ||
      // a book holding several volumes stored before it was known as one
      // ("Vinland Saga, Vol. 18" for Book 9): searched and scanned by its
      // book name from now on
      (saved.inBook && stored.title !== saved.title))
  ) {
    await priceQueries.upsertBook({ ...stored, title: saved.title });
    return priceQueries.getBook(isbn13);
  }
  if (stored) return stored;
  // the catalog being down shouldn't break a page the series list can name
  const found =
    saved ??
    (await lookupIsbn(isbn13).catch((e: Error) => {
      console.error("ISBN lookup failed:", e.message);
      return null;
    }));
  if (!found) return null;
  await priceQueries.upsertBook(found);
  return priceQueries.getBook(isbn13);
}

// whether a volume page would find its book, the way getOrCreateBook does, but
// without storing anything: for telling search engines a page is really
// missing. A catalog that can't be reached throws, so that's never "missing"
export async function volumeExists(isbn13: string): Promise<boolean> {
  const [stored, saved] = await Promise.all([
    priceQueries.getBook(isbn13),
    priceQueries.getSavedVolume(isbn13).catch(() => null),
  ]);
  if (stored || saved) return true;
  return Boolean(await lookupIsbn(isbn13));
}

// a volume's release date while it's still to come, as its series page has it
// (dates found under other names and catalogs included). For the Canada
// prices, which have only the ISBN: a preorder spends no paid searches there
// either
export async function upcomingReleaseOf(isbn13: string) {
  const book = await priceQueries.getBook(isbn13).catch(() => null);
  if (!book) return null;
  const series = await getSeriesWithVolumes(seriesName(book.title)).catch(
    () => null,
  );
  return notOutYet(series?.volumes.find((v) => v.isbn13 === isbn13)?.published);
}

// `refresh: false` shows what's stored without fetching new prices (crawlers)
export async function getVolumePrices(isbn13: string, { refresh = true } = {}) {
  const book = await getOrCreateBook(isbn13);
  if (!book) return null;

  const series = await getSeriesWithVolumes(seriesName(book.title));
  // paid searches only for a volume of a series AniList knows, as the catalog
  // lists it: anyone can open a page for any ISBN, and made-up or unrelated
  // ones mustn't spend the month's searches
  // a light novel AniList doesn't list (Solo Leveling's) still counts when the
  // catalog lists the volume as one of the novel's
  const known =
    (Boolean(series.info) || isNovelName(series.name)) &&
    series.volumes.some((v) => v.isbn13.trim() === isbn13);
  // not out yet: no paid search, the page offers the preorder links instead
  const preorder = notOutYet(
    series.volumes.find((v) => v.isbn13 === book.isbn13)?.published,
  );
  const checked =
    refresh && known && !preorder ? await refreshIfStale(isbn13, book) : null;

  const last = checked
    ? checked.unchanged
    : await priceQueries.getLastCheck(isbn13);
  const [stored, usual] = await Promise.all([
    last ? priceQueries.getLatestOffers(isbn13, last.checkedAt) : [],
    priceQueries.getNewPriceMedian(isbn13),
  ]);
  // the median once, not again inside the history
  const history = await priceQueries.getPriceHistory(isbn13, usual);
  // checks saved before a rule changed still get held to it
  const offers = dropUnlikelyNew(stored, usual);

  // a book holding several volumes says which, rather than a volume number
  const inBook =
    series.volumes.find((v) => v.isbn13 === book.isbn13 && v.inBook)?.inBook ??
    null;
  const seen = new Set([book.isbn13]);
  return {
    series: { name: series.name, slug: series.slug, info: series.info },
    volume: inBook ? null : titleVolume(book.title),
    inBook,
    // its release date, when it isn't out yet
    preorder,
    // the rest of the series, for the "from the same series" row: each book
    // once, though it holds two volumes
    siblings: series.volumes.filter((v) => {
      if (seen.has(v.isbn13)) return false;
      seen.add(v.isbn13);
      return true;
    }),
    book: {
      isbn13: book.isbn13,
      title: book.title,
      authors: book.authors,
      publisher: book.publisher,
      coverUrl: book.coverUrl,
      year: book.year,
    },
    offers: offers.map((o) => {
      const url = affiliateOfferUrl(o, isbn13);
      return { ...o, url, affiliate: isAffiliateUrl(url) };
    }),
    // only once there's been a check, when it has a first and last date
    history:
      history.checks && history.since && history.lastSeen
        ? { ...history, since: history.since, lastSeen: history.lastSeen }
        : null,
    checkedAt: last?.checkedAt ?? null,
    liveSources: enabledProviders().map((p) => p.store),
    storeLinks: storeLinks(isbn13),
  };
}

// ---------- a scanned barcode ----------

// which series and volume a scanned ISBN is, for adding it to a shelf. The
// stored book or the free catalog only: it never asks a store for a price, so
// a scan never spends a paid search. Null when the catalog doesn't know it or
// the title carries no volume number
export async function lookupScannedIsbn(isbn13: string) {
  const book = await getOrCreateBook(isbn13);
  if (!book) return null;
  const named = seriesName(book.title);
  // a book holding several volumes ("Vinland Saga, Book 9"): the series'
  // list says which, and every one of them goes on the shelf
  const inBook =
    bookNumberOf(book.title) === null
      ? null
      : ((await getSeriesWithVolumes(named).catch(() => null))?.volumes.find(
          (v) => v.isbn13 === book.isbn13 && v.inBook,
        )?.inBook ?? null);
  // an omnibus ("One Piece, Vol. 1 (Romance Dawn / … )" is vols 1 to 3):
  // every volume in it, or nothing at all when it can't say which
  const omnibus = inBook ? null : omnibusVolumes(book.title);
  if (omnibus && !omnibus.length) return null;
  const volume = inBook
    ? inBook.from
    : omnibus
      ? omnibus[0]!
      : titleVolume(book.title);
  if (volume == null) return null;
  // the catalog sometimes says so only in brackets ("Overlord, Vol. 3 (light
  // novel)"), which seriesName drops
  const lightNovel =
    isNovelName(named) ||
    isNovelBook(book.title) ||
    /\blight novel\b/i.test(book.title);
  // a novel goes by "Overlord Light Novel", so the shelf match finds the
  // novel and never the manga of the same name
  const series = lightNovel ? novelName(baseName(named)) : named;
  return {
    isbn13: book.isbn13,
    title: book.title,
    volume,
    // every volume it holds, when it's one book holding several
    volumes: inBook
      ? Array.from(
          { length: inBook.to - inBook.from + 1 },
          (_, i) => inBook.from + i,
        )
      : (omnibus ?? [volume]),
    // the price checker's name ("Overlord Light Novel"), for /api/manga/match
    series,
    // the name a shelf keeps it under: a novel is the series' own name, marked
    shelfName: lightNovel ? baseName(series) : series,
    lightNovel,
    coverUrl: book.coverUrl,
  };
}

export type ScannedBook = NonNullable<
  Awaited<ReturnType<typeof lookupScannedIsbn>>
>;

export type VolumePrices = NonNullable<
  Awaited<ReturnType<typeof getVolumePrices>>
>;

// ---------- series ----------

const SERIES_VOLUMES_FRESH_MS = 12 * 60 * 60 * 1000;
// with a saved list to show, the catalog being down can wait this long before
// anyone sits through asking it again
const SERIES_VOLUMES_RETRY_MS = 10 * 60 * 1000;
const seriesVolumesCache = new Map<
  string,
  { at: number; volumes: CatalogBook[] }
>();

// every numbered volume of a series from the free catalog, one ISBN per
// volume number, cached half a day. Never spends a paid price search.
// "incomplete" means a catalog query or a title translation failed for a
// passing reason, so volumes may be missing; such a list is never cached,
// so the next visit tries again
// what's known already plus what the catalog says now, with its version of any
// volume winning. Its answers vary from one search to the next, and a volume it
// happened to leave out this time is still a real volume
export const mergeVolumes = (known: CatalogBook[], found: CatalogBook[]) => {
  const byNumber = new Map(known.map((v) => [v.volume, v]));
  const books = bookIsbns([...known, ...found]);
  for (const v of found) {
    // a book holding several volumes listed as if it were one isn't
    if (!v.inBook && books.has(v.isbn13)) continue;
    const had = byNumber.get(v.volume);
    // a volume sold on its own is never swapped for the book holding it
    if (v.inBook && had && !had.inBook) continue;
    // a release date already known isn't lost to an answer without one
    byNumber.set(
      v.volume,
      had?.published && !v.published && had.isbn13 === v.isbn13
        ? { ...v, published: had.published }
        : v,
    );
  }
  return [...byNumber.values()].sort(
    (a, b) => (a.volume ?? 0) - (b.volume ?? 0),
  );
};

// ---------- one list from several answers ----------

// the ISBNs of books holding several volumes ("Vinland Saga, Book 6")
const bookIsbns = (volumes: CatalogBook[]) =>
  new Set(volumes.filter((v) => v.inBook).map((v) => v.isbn13));

// a volume found again, under another name or by another catalog, into the
// list being built. The first answer for a number stays, except that a volume
// sold on its own beats a book holding it. A listing whose ISBN is such a book
// (Google Books calls Vinland Saga's Book 6 "Vinland Saga 6"), or that's
// already in the list under another number, isn't a volume of its own. A
// release date the kept one lacks is taken from the same ISBN, or noted
function addVolume(
  byNumber: Map<number | null, CatalogBook>,
  v: CatalogBook,
  books: Set<string>,
  datedElsewhere: Map<number | null, string>,
) {
  // a series sold as books holding several volumes (Vinland Saga in English)
  // takes no lone volumes from other answers: Google Books lists its books
  // as "Vinland Saga 12", under ISBNs Open Library doesn't use
  if (!v.inBook && books.size > 0) return;
  if (
    !v.inBook &&
    [...byNumber.values()].some(
      (b) => b.isbn13 === v.isbn13 && b.volume !== v.volume,
    )
  )
    return;
  const had = byNumber.get(v.volume);
  if (!had || (had.inBook && !v.inBook)) byNumber.set(v.volume, v);
  else if (v.published && !had.published) {
    if (had.isbn13 === v.isbn13)
      byNumber.set(v.volume, { ...had, published: v.published });
    else datedElsewhere.set(v.volume, v.published);
  }
}

// the catalogs can give an upcoming volume different ISBNs: its date still
// says it's a preorder. The last few volumes only: an old volume's special
// edition coming out later must never make the volume itself look unreleased
function adoptUpcomingDates(
  byNumber: Map<number | null, CatalogBook>,
  datedElsewhere: Map<number | null, string>,
) {
  const newest = Math.max(0, ...[...byNumber.keys()].map(Number));
  for (const [n, date] of datedElsewhere) {
    const had = byNumber.get(n);
    if (
      had &&
      !had.published &&
      n != null &&
      n >= newest - 2 &&
      notOutYet(date)
    )
      byNumber.set(n, { ...had, published: date });
  }
}

// Open Library often can't say which format a book is: the Shield Hero novels
// are filed as "Comics & graphic novels", like the manga. Length can: light
// novels run about 230 to 400 pages, manga volumes about 130 to 200. Only
// used for a series that has both, so a long manga with no novel (Vinland
// Saga's 450-page hardcovers) is never touched
const NOVEL_PAGES = 230;
const isLong = (v: CatalogBook) => (v.pages ?? 0) >= NOVEL_PAGES && !v.comic;

// a light novel by exactly this name. AniList's search answers almost any
// name with some novel ("Berserk" -> Berserk: The Flame Dragon Knight), and
// treating that as Berserk's own would drop its long volumes from the manga
const sameSeries = (a: string, b: string) => seriesOf(a) === seriesOf(b);
async function hasLightNovel(name: string) {
  const info = await getSeriesInfo(novelName(name)).catch(() => null);
  if (!info) return false;
  return [info.name, ...info.altNames].some((n) =>
    sameSeries(baseName(n), name),
  );
}

// searchAs: look the series up by another name and file what's found under
// `name`: its Japanese one ("ヴィンランド・サガ"), which Open Library files some
// US editions under. google: ask Google Books instead of Open Library (new and
// upcoming volumes), kept for days so its 1,000 free lookups a day go far.
// Each saved apart from the English lookup
const GOOGLE_VOLUMES_FRESH_MS = 3 * 24 * 60 * 60 * 1000;
export async function seriesVolumes(
  name: string,
  { searchAs, google = false }: { searchAs?: string; google?: boolean } = {},
): Promise<{ volumes: CatalogBook[]; incomplete: boolean }> {
  const series = seriesOf(name);
  const key = searchAs
    ? `${volumesKey(name)}:native`
    : google
      ? `${volumesKey(name)}:google`
      : volumesKey(name);
  const freshFor = google ? GOOGLE_VOLUMES_FRESH_MS : SERIES_VOLUMES_FRESH_MS;
  // memory first, then the database, which outlives a restart. A database
  // problem just means asking the catalog
  const hit =
    seriesVolumesCache.get(key) ??
    (await priceQueries.getSeriesVolumes(key).catch((e: Error) => {
      console.error("Couldn't read saved series volumes:", e.message);
      return null;
    }));
  if (hit && Date.now() - hit.at < freshFor) {
    seriesVolumesCache.set(key, hit);
    return { volumes: hit.volumes, incomplete: false };
  }

  // free catalog queries merged: the plain one finds more, the quoted title
  // one is more precise. Long runners can have 100+ volumes. A light novel's
  // editions mostly go by the manga's name ("Overlord, Vol. 3"), so the
  // quoted one is the base name either way. A novel also gets "<name> novel":
  // "… Light Novel" alone can come back as junk (Solo Leveling's did), yet it
  // finds some the other misses (two of Spice & Wolf's)
  const novel = isNovelName(name);
  const quoted = `title:"${baseName(name).replace(/"/g, "")}"`;
  const queries = searchAs
    ? [searchAs]
    : novel
      ? [name, `${baseName(name)} novel`, quoted]
      : [name, quoted];
  // a manga whose series has a novel too: its long books are the novel's
  const [results, hasNovel] = await Promise.all([
    google
      ? Promise.allSettled([
          googleSeriesVolumes(name).then((books) => ({
            books,
            degraded: false,
          })),
        ])
      : Promise.allSettled(
          queries.map((q) =>
            searchVolumesDetailed(q, {
              max: 250,
              timeoutMs: 20000,
              seriesName: name,
            }),
          ),
        ),
    novel ? Promise.resolve(true) : hasLightNovel(name),
  ]);
  const base = seriesOf(baseName(name));
  const found = results.flatMap((r) =>
    r.status === "fulfilled" ? r.value.books : [],
  );
  const failed = results.filter((r) => r.status === "rejected");
  // a title this lookup couldn't translate right now
  const untranslated = results.some(
    (r) => r.status === "fulfilled" && r.value.degraded,
  );
  failed.forEach((r) =>
    console.error("series volume lookup failed:", (r.reason as Error)?.message),
  );

  const byNumber = new Map<number | null, CatalogBook>();
  // dates given a volume under another ISBN than the one kept
  const datedElsewhere = new Map<number | null, string>();
  const books = bookIsbns(found);
  for (const found1 of found) {
    let v = found1;
    // a long book under the manga's name is the novel's
    const unmarked =
      seriesOf(v.title) === base && v.volume !== null && isLong(v);
    if (novel && unmarked) v = { ...v, title: `${name}, Vol. ${v.volume}` };
    if (!novel && hasNovel && unmarked) continue;
    if (seriesOf(v.title) !== series || v.volume === null) continue;
    // "Kaiju No. 8" alone is the series, not its eighth volume
    if (normalize(v.title) === normalize(name)) continue;
    // a set is only ever sold as a set, so it can't stand in for one volume
    if (!isSingleVolume(v.title)) continue;
    addVolume(byNumber, v, books, datedElsewhere);
  }
  adoptUpcomingDates(byNumber, datedElsewhere);
  const volumes = mergeVolumes(hit?.volumes ?? [], [...byNumber.values()]);

  if (failed.length > 0 || untranslated) {
    // a saved list covers for the outage, and the catalog gets another go soon
    if (hit?.volumes.length) {
      const at = Date.now() - freshFor + SERIES_VOLUMES_RETRY_MS;
      seriesVolumesCache.set(key, { at, volumes: hit.volumes });
      return { volumes, incomplete: false };
    }
    return { volumes, incomplete: true };
  }
  seriesVolumesCache.set(key, { at: Date.now(), volumes });
  // an empty answer counts too: every other name a series goes by would
  // otherwise be asked about again after each restart
  await priceQueries
    .saveSeriesVolumes(key, volumes)
    .catch((e: Error) =>
      console.error("Couldn't save series volumes:", e.message),
    );
  if (seriesVolumesCache.size > 500) {
    seriesVolumesCache.delete(seriesVolumesCache.keys().next().value!);
  }
  return { volumes, incomplete: false };
}

const JAPANESE_SCRIPT = /[\u3040-ヿ㐀-鿿]/;

// AniList's official English name plus up to three other English names,
// skipping any that are the link's own name
const otherNamesFor = (name: string, info: SeriesInfo | null) => {
  const seen = new Set([seriesOf(name)]);
  return [info?.name, ...(info?.altNames ?? []).slice(0, 3)].filter(
    (alt): alt is string => {
      if (!alt || seen.has(seriesOf(alt))) return false;
      seen.add(seriesOf(alt));
      return true;
    },
  );
};

async function getSeriesWithVolumes(name: string) {
  const infoLookup = getSeriesInfo(name);
  // the other names only need AniList's answer, so they're searched while
  // the main name's catalog search is still running
  const altLookup = infoLookup.then((info) =>
    Promise.all([
      ...otherNamesFor(name, info).map((alt) => seriesVolumes(alt)),
      // its Japanese name too, when it has one in Japanese script (MONSTER's
      // or PLUTO's would only find unrelated books). Manga only: a novel's
      // Japanese name is its manga's too
      ...(info?.nativeName &&
      JAPANESE_SCRIPT.test(info.nativeName) &&
      !isNovelName(name)
        ? [seriesVolumes(name, { searchAs: info.nativeName })]
        : []),
    ]),
  );
  // Google Books, once, under AniList's official English name (it knows
  // Frieren by its full one): new and upcoming volumes Open Library lacks
  const googleLookup = infoLookup.then((info) =>
    seriesVolumes(info?.name || name, { google: true }),
  );
  const [info, main, altResults, fromGoogle] = await Promise.all([
    infoLookup,
    seriesVolumes(name),
    altLookup,
    googleLookup,
  ]);
  // the link's name may be short ("Frieren") while the volumes carry the
  // full English name ("Frieren: Beyond Journey's End"). A series can also be
  // sold under other names (Detective Conan is mostly catalogued as Case
  // Closed). Volumes found under AniList's official English name and its
  // alternatives are merged in by volume number
  // with the same rules as within one search (addVolume), Google's last
  const byNumber = new Map<number | null, CatalogBook>(
    main.volumes.map((v) => [v.volume, v]),
  );
  const datedElsewhere = new Map<number | null, string>();
  const lists = [...altResults, fromGoogle];
  const books = bookIsbns([main, ...lists].flatMap((l) => l.volumes));
  for (const list of lists) {
    for (const v of list.volumes) addVolume(byNumber, v, books, datedElsewhere);
  }
  adoptUpcomingDates(byNumber, datedElsewhere);
  // numbered ones only: pages list and page through volumes by number, so a
  // numberless book (the catalog's search can return one) has no place there
  const volumes = [...byNumber.values()]
    .filter((v): v is CatalogBook & { volume: number } => v.volume != null)
    .sort((a, b) => a.volume - b.volume);
  // start finding every cover now, in one batch, so they're ready by the
  // time the browser asks for them (failures are retried when it asks)
  volumes.forEach((v) => editionCoverId(v.isbn13).catch(() => {}));
  // the main name's problems always count. An other name's only count when
  // they left the page nearly empty: a slow obscure alias shouldn't flag a
  // series that already has its volumes
  const incomplete =
    main.incomplete ||
    (altResults.some((a) => a.incomplete) && volumes.length < 3);
  const known = await priceQueries.getKnownPrices(volumes.map((v) => v.isbn13));
  return {
    name,
    slug: slugify(name),
    info,
    incomplete,
    volumes: volumes.map((v) => ({
      isbn13: v.isbn13,
      title: v.title,
      volume: v.volume,
      coverUrl: v.coverUrl,
      knownPriceCents: known.get(v.isbn13)?.priceCents ?? null,
      ...(v.inBook ? { inBook: v.inBook } : {}),
      ...(v.published ? { published: v.published } : {}),
    })),
  };
}

export async function getSeries(asked: string) {
  const name = await knownSeriesName(asked);
  const series = await getSeriesWithVolumes(name);
  if (!series.info && !series.volumes.length) {
    // nothing at all because the catalog was down isn't "not found"
    if (series.incomplete) throw new Error("catalog unavailable");
    return null;
  }
  return series;
}

// ---------- the shelf ----------

type KnownVolume = { isbn13: string; title: string };

// the volumes we know for each series, grouped by the series' slug.
// Rebuilt every few minutes; shared by everyone's shelf
const KNOWN_VOLUMES_MS = 10 * 60 * 1000;
let knownVolumes = {
  at: 0,
  bySeries: new Map<string, Map<string, KnownVolume>>(),
};

async function knownVolumesBySeries() {
  if (Date.now() - knownVolumes.at < KNOWN_VOLUMES_MS) {
    return knownVolumes.bySeries;
  }
  const bySeries = new Map<string, Map<string, KnownVolume>>();
  const add = (v: KnownVolume) => {
    const key = slugify(seriesName(v.title));
    if (!bySeries.has(key)) bySeries.set(key, new Map());
    bySeries.get(key)!.set(v.isbn13, v);
  };
  (await priceQueries.getBookTitles()).forEach(add);
  // full volume lists from series pages people opened recently
  for (const hit of seriesVolumesCache.values()) hit.volumes.forEach(add);
  knownVolumes = { at: Date.now(), bySeries };
  return bySeries;
}

type ShelfPrice = {
  fromCents: number;
  isbn13: string;
  title: string;
  volume: number | null;
};

// the cheapest price we already know for each manga on a shelf. Database
// and memory only: a whole shelf never sets off catalog or store lookups
export async function getShelfPrices(
  manga: { id: number; name: string }[],
): Promise<Record<number, ShelfPrice>> {
  const [bySeries, names] = await Promise.all([
    knownVolumesBySeries(),
    // one query for the whole shelf, not one per manga
    knownSeriesNames().catch(() => new Map<string, string>()),
  ]);
  const matches = new Map<number, KnownVolume[]>();
  for (const m of manga) {
    const keys = new Set([slugify(m.name), slugify(seriesName(m.name))]);
    const known = names.get(slugify(m.name)) ?? m.name;
    keys.add(slugify(known));
    const volumes = [...keys].flatMap((k) => [
      ...(bySeries.get(k)?.values() ?? []),
    ]);
    if (volumes.length) matches.set(m.id, volumes);
  }

  const isbns = [...matches.values()].flat().map((v) => v.isbn13);
  const prices = await priceQueries.getKnownPrices([...new Set(isbns)]);
  const result: Record<number, ShelfPrice> = {};
  for (const [id, volumes] of matches) {
    let best: ShelfPrice | null = null;
    for (const v of volumes) {
      const cents = prices.get(v.isbn13)?.priceCents;
      if (cents != null && (!best || cents < best.fromCents)) {
        best = {
          fromCents: cents,
          isbn13: v.isbn13,
          title: v.title,
          volume: titleVolume(v.title),
        };
      }
    }
    if (best) result[id] = best;
  }
  return result;
}

// the manga on someone's shelf that is this series, if any. Names are
// compared by slug, so "SPY x FAMILY" on a shelf finds "Spy x Family"
export async function findOnShelf<T extends { name: string }>(
  manga: T[],
  series: string,
): Promise<T | null> {
  const wanted = new Set([slugify(series), slugify(seriesName(series))]);
  wanted.add(slugify(await knownSeriesName(series).catch(() => series)));
  return (
    manga.find(
      (m) =>
        wanted.has(slugify(m.name)) || wanted.has(slugify(seriesName(m.name))),
    ) ?? null
  );
}

// ---------- series index ----------

// every series on the site for the /series page: AniList's facts plus how
// many US volumes we know. Database and memory only
export async function getSeriesIndex() {
  const [series, bySeries] = await Promise.all([
    listKnownSeries(),
    knownVolumesBySeries(),
  ]);
  return series.map((info) => ({
    name: info.name,
    coverUrl: info.coverUrl,
    score: info.score,
    popularityRank: info.popularityRank,
    genres: info.genres ?? [],
    status: info.status,
    volumes: info.volumes,
    knownVolumes: bySeries.get(slugify(info.name))?.size ?? 0,
  }));
}

// ---------- link previews ----------

// what a shared link's preview needs, from the database alone: no catalog,
// no store APIs, so the site's preview server can ask on every page load
export async function getVolumeSummary(isbn13: string) {
  const book = await priceQueries.getBook(isbn13);
  if (!book) return null;
  const last = await priceQueries.getLastCheck(isbn13);
  const [stored, usual] = await Promise.all([
    last ? priceQueries.getLatestOffers(isbn13, last.checkedAt) : [],
    priceQueries.getNewPriceMedian(isbn13),
  ]);
  const offers = dropUnlikelyNew(stored, usual);
  const inStock = offers.filter((o) => o.inStock);
  const bestNew = inStock.find(
    (o) => o.condition === "new" && o.format === "print",
  );
  const [series, [coverRow]] = await Promise.all([
    getSeriesInfo(seriesName(book.title)).catch(() => null),
    priceQueries.getCoverIds([isbn13]).catch(() => []),
  ]);
  return {
    isbn13: book.isbn13.trim(),
    title: book.title,
    authors: book.authors,
    publisher: book.publisher,
    year: book.year,
    // an edition we know has no cover: none, so previews and search engines
    // get the series' picture instead of an image address that answers 404
    coverUrl: coverRow && coverRow.coverId === null ? null : book.coverUrl,
    seriesName: series?.name ?? seriesName(book.title),
    seriesCoverUrl: series?.coverUrl ?? null,
    stores: [...new Set(offers.map((o) => o.store))],
    lowCents: inStock[0]?.priceCents ?? null,
    highCents: inStock.at(-1)?.priceCents ?? null,
    offerCount: inStock.length,
    bestNew: bestNew
      ? { store: bestNew.store, priceCents: bestNew.priceCents }
      : null,
  };
}

export async function getSeriesSummary(asked: string) {
  const name = await knownSeriesName(asked);
  const info = await getSeriesInfo(name).catch(() => null);
  if (!info) return null;
  return {
    name: info.name,
    description: info.description,
    coverUrl: info.coverUrl,
    genres: info.genres,
  };
}

// ---------- price home ----------

// latest deals: volumes now cheaper than their own average, from prices we
// already have. Recently checked: the latest volumes anyone looked up
// the popular row: only series we've found English books for. AniList's
// trending list is full of series read in English only on apps, or not yet
// translated, whose pages would say there's nothing to price. One not looked
// up yet is looked up after answering, a few at a time, and joins the row
// once its books are found
const TRENDING_SHOWN = 12;
const TRENDING_CHECKS_PER_VISIT = 6;
const checkingTrending = new Set<string>();
// what a background check found, by the name the row asked about (the series
// may be saved under another): rechecked after a day when it found nothing
const TRENDING_RECHECK_MS = 24 * 60 * 60 * 1000;
const trendingFound = new Map<string, { at: number; books: number }>();
async function withEnglishBooks(hits: SeriesHit[]) {
  const keyOf = (h: SeriesHit) => volumesKey(h.name);
  const nativeKeyOf = (h: SeriesHit) => `${volumesKey(h.name)}:native`;
  const sizes = await priceQueries
    .getSavedListSizes(hits.flatMap((h) => [keyOf(h), nativeKeyOf(h)]))
    .catch(() => null);
  // the database down: the row as AniList has it rather than an empty one
  if (!sizes) return hits.slice(0, TRENDING_SHOWN);
  const books = (h: SeriesHit) =>
    (sizes.get(keyOf(h))?.size ?? 0) +
    (sizes.get(nativeKeyOf(h))?.size ?? 0) +
    (trendingFound.get(h.name)?.books ?? 0);
  const checked = (h: SeriesHit) => {
    const found = trendingFound.get(h.name);
    return found
      ? found.books > 0 || Date.now() - found.at < TRENDING_RECHECK_MS
      : sizes.has(keyOf(h)) && (sizes.get(keyOf(h))?.size ?? 0) > 0;
  };
  const unchecked = hits
    .filter((h) => !checked(h) && !checkingTrending.has(h.name))
    .slice(0, TRENDING_CHECKS_PER_VISIT);
  void (async () => {
    for (const h of unchecked) {
      checkingTrending.add(h.name);
      const series = await getSeries(h.name).catch(() => null);
      if (series)
        trendingFound.set(h.name, {
          at: Date.now(),
          books: series.volumes.length,
        });
      checkingTrending.delete(h.name);
    }
  })();
  return hits.filter((h) => books(h) > 0).slice(0, TRENDING_SHOWN);
}

export async function getHighlights() {
  const [trending, latest] = await Promise.all([
    getTrending().then(withEnglishBooks),
    priceQueries.getRecentBestPrices(40),
  ]);
  // the same believable price the volume's own page shows, so a fake one can't
  // headline as a deal
  const known = await priceQueries.getKnownPrices(
    latest.map((r) => r.isbn13.trim()),
  );
  const recent = latest.flatMap((r) => {
    const price = known.get(r.isbn13.trim());
    return price ? [{ ...r, priceCents: price.priceCents }] : [];
  });
  const dealRows = recent
    .filter((r) => r.samples >= 2 && r.priceCents < r.avgCents * 0.95)
    .sort((a, b) => a.priceCents / a.avgCents - b.priceCents / b.avgCents)
    .slice(0, 8);
  const recentRows = recent.slice(0, 12);

  // each series' AniList cover, shown when a volume has no US cover of its
  // own. Cached a week, and a series AniList can't find just goes without
  const names = [
    ...new Set([...dealRows, ...recentRows].map((r) => seriesName(r.title))),
  ];
  const infos = await Promise.all(
    names.map((name) => getSeriesInfo(name).catch(() => null)),
  );
  const seriesCovers = new Map(
    names.map((name, i) => [name, infos[i]?.coverUrl ?? null]),
  );

  const toCard = (r: (typeof recent)[number]) => ({
    isbn13: r.isbn13.trim(),
    title: r.title,
    volume: titleVolume(r.title),
    coverUrl: r.coverUrl,
    seriesCoverUrl: seriesCovers.get(seriesName(r.title)) ?? null,
    priceCents: r.priceCents,
    avgCents: r.avgCents,
    checkedAt: r.fetchedAt,
  });
  return {
    trending,
    deals: dealRows.map(toCard),
    recent: recentRows.map(toCard),
  };
}
