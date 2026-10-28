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
import { lookupIsbn, searchVolumesDetailed } from "./catalog.js";
import {
  getSeriesInfo,
  getTrending,
  knownSeriesName,
  listKnownSeries,
  searchSeries,
} from "./anilist.js";
import { seriesName, seriesOf, slugify, volumeOf } from "./match.js";
import { enabledProviders } from "./providers/index.js";
import { affiliateOfferUrl, isAffiliateUrl, storeLinks } from "./storeLinks.js";
import { editionCoverId } from "./covers.js";
import { dropUnlikelyNew } from "./retailers.js";
import type { CatalogBook, Offer, SeriesInfo } from "./types.js";

export { searchSeries };

// prices are re-fetched at most this often per volume; in between, people
// see the stored ones. Keeps us well inside every API's rate limits
const FRESH_FOR_MS = 6 * 60 * 60 * 1000;
const PROVIDER_TIMEOUT_MS = 8000;

const numberOrNull = (n: number) => (Number.isFinite(n) ? n : null);

// ---------- one volume ----------

// one fetch per ISBN at a time, even if several people open it at once
const inFlight = new Map<string, Promise<unknown>>();

// asks every enabled provider at once; one failing doesn't stop the others
async function fetchAllProviders(isbn13: string, book: Book) {
  const providers = enabledProviders();
  const results = await Promise.allSettled(
    providers.map((p) =>
      p.fetchOffers(isbn13, AbortSignal.timeout(PROVIDER_TIMEOUT_MS), book),
    ),
  );

  const offers: Offer[] = [];
  const sources: string[] = [];
  results.forEach((r, i) => {
    const provider = providers[i]!;
    if (r.status === "fulfilled") {
      sources.push(provider.id);
      offers.push(...r.value);
    } else {
      console.error(`price provider ${provider.id} failed:`, r.reason);
    }
  });

  // only record a check if at least one source answered, so an outage
  // doesn't leave a volume looking "checked, nothing found" for six hours
  if (providers.length && sources.length) {
    // judged against this volume's own usual new price before storing, so
    // a fake bargain never reaches the history
    const usual = await priceQueries.getNewPriceMedian(isbn13);
    await priceQueries.saveCheck(isbn13, sources, dropUnlikelyNew(offers, usual));
  }
}

async function refreshIfStale(isbn13: string, book: Book) {
  const last = await priceQueries.getLastCheck(isbn13);
  const fresh = last && Date.now() - last.checkedAt.getTime() < FRESH_FOR_MS;
  if (fresh || !enabledProviders().length) return;

  if (!inFlight.has(isbn13)) {
    inFlight.set(
      isbn13,
      fetchAllProviders(isbn13, book).finally(() => inFlight.delete(isbn13)),
    );
  }
  await inFlight.get(isbn13);
}

// the stored book, or the catalog's answer stored for next time
async function getOrCreateBook(isbn13: string) {
  const stored = await priceQueries.getBook(isbn13);
  if (stored) return stored;
  const found = await lookupIsbn(isbn13);
  if (!found) return null;
  await priceQueries.upsertBook(found);
  return priceQueries.getBook(isbn13);
}

// `refresh: false` shows what's stored without fetching new prices (crawlers)
export async function getVolumePrices(isbn13: string, { refresh = true } = {}) {
  const book = await getOrCreateBook(isbn13);
  if (!book) return null;

  if (refresh) await refreshIfStale(isbn13, book);

  const last = await priceQueries.getLastCheck(isbn13);
  const [offers, history] = await Promise.all([
    last ? priceQueries.getLatestOffers(isbn13, last.checkedAt) : [],
    priceQueries.getPriceHistory(isbn13),
  ]);

  const series = await getSeriesWithVolumes(seriesName(book.title));

  return {
    series: { name: series.name, slug: series.slug, info: series.info },
    volume: numberOrNull(volumeOf(book.title)),
    // the rest of the series, for the "from the same series" row
    siblings: series.volumes.filter((v) => v.isbn13 !== book.isbn13),
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
    history: history.checks ? history : null,
    checkedAt: last?.checkedAt ?? null,
    liveSources: enabledProviders().map((p) => p.store),
    storeLinks: storeLinks(isbn13),
  };
}

export type VolumePrices = NonNullable<
  Awaited<ReturnType<typeof getVolumePrices>>
>;

// ---------- series ----------

const SERIES_VOLUMES_FRESH_MS = 12 * 60 * 60 * 1000;
const seriesVolumesCache = new Map<
  string,
  { at: number; volumes: CatalogBook[] }
>();

// every numbered volume of a series from the free catalog, one ISBN per
// volume number, cached half a day. Never spends a paid price search.
// "incomplete" means a catalog query or a title translation failed for a
// passing reason, so volumes may be missing; such a list is never cached,
// so the next visit tries again
async function seriesVolumes(
  name: string,
): Promise<{ volumes: CatalogBook[]; incomplete: boolean }> {
  const key = seriesOf(name);
  const hit = seriesVolumesCache.get(key);
  if (hit && Date.now() - hit.at < SERIES_VOLUMES_FRESH_MS) {
    return { volumes: hit.volumes, incomplete: false };
  }

  // two free catalog queries merged: the plain one finds more, the quoted
  // title one is more precise. Long runners can have 100+ volumes
  const results = await Promise.allSettled([
    searchVolumesDetailed(name, { max: 250, timeoutMs: 20000 }),
    searchVolumesDetailed(`title:"${name.replace(/"/g, "")}"`, {
      max: 250,
      timeoutMs: 20000,
    }),
  ]);
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

  const byNumber = new Map<number, CatalogBook>();
  for (const v of found) {
    if (seriesOf(v.title) !== key || v.volume === null) continue;
    if (!byNumber.has(v.volume)) byNumber.set(v.volume, v);
  }
  const volumes = [...byNumber.values()].sort(
    (a, b) => (a.volume ?? 0) - (b.volume ?? 0),
  );

  if (failed.length > 0 || untranslated) {
    // an older complete list beats a damaged new one
    if (hit && hit.volumes.length > volumes.length) {
      return { volumes: hit.volumes, incomplete: false };
    }
    return { volumes, incomplete: true };
  }
  seriesVolumesCache.set(key, { at: Date.now(), volumes });
  if (seriesVolumesCache.size > 500) {
    seriesVolumesCache.delete(seriesVolumesCache.keys().next().value!);
  }
  return { volumes, incomplete: false };
}

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
    Promise.all(otherNamesFor(name, info).map((alt) => seriesVolumes(alt))),
  );
  const [info, main, altResults] = await Promise.all([
    infoLookup,
    seriesVolumes(name),
    altLookup,
  ]);
  // the link's name may be short ("Frieren") while the volumes carry the
  // full English name ("Frieren: Beyond Journey's End"). A series can also be
  // sold under other names (Detective Conan is mostly catalogued as Case
  // Closed). Volumes found under AniList's official English name and its
  // alternatives are merged in by volume number
  const byNumber = new Map(main.volumes.map((v) => [v.volume, v]));
  for (const alt of altResults) {
    for (const v of alt.volumes) {
      if (!byNumber.has(v.volume)) byNumber.set(v.volume, v);
    }
  }
  const volumes = [...byNumber.values()].sort(
    (a, b) => (a.volume ?? 0) - (b.volume ?? 0),
  );
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

export type ShelfPrice = {
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
  const bySeries = await knownVolumesBySeries();
  const matches = new Map<number, KnownVolume[]>();
  for (const m of manga) {
    const keys = new Set([slugify(m.name), slugify(seriesName(m.name))]);
    const known = await knownSeriesName(m.name).catch(() => m.name);
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
          volume: numberOrNull(volumeOf(v.title)),
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
  const offers = last
    ? await priceQueries.getLatestOffers(isbn13, last.checkedAt)
    : [];
  const inStock = offers.filter((o) => o.inStock);
  const bestNew = inStock.find(
    (o) => o.condition === "new" && o.format === "print",
  );
  const series = await getSeriesInfo(seriesName(book.title)).catch(() => null);
  return {
    isbn13: book.isbn13.trim(),
    title: book.title,
    authors: book.authors,
    publisher: book.publisher,
    year: book.year,
    coverUrl: book.coverUrl,
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
export async function getHighlights() {
  const [trending, recent] = await Promise.all([
    getTrending(),
    priceQueries.getRecentBestPrices(40),
  ]);
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
    volume: numberOrNull(volumeOf(r.title)),
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
