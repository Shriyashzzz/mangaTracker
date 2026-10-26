import priceQueries from "../models/priceQueries.js";
import { lookupIsbn, searchVolumes } from "./catalog.js";
import {
  getSeriesInfo,
  getTrending,
  searchSeries,
  slugify,
} from "./anilist.js";
import { seriesName, seriesOf, volumeOf } from "./match.js";
import { enabledProviders } from "./providers/index.js";
import { storeLinks } from "./storeLinks.js";

// prices are re-fetched at most this often per volume; in between, people
// see the stored ones. Keeps us well inside every API's rate limits
const FRESH_FOR_MS = 6 * 60 * 60 * 1000;
const PROVIDER_TIMEOUT_MS = 8000;

// one fetch per ISBN at a time, even if several people open it at once
const inFlight = new Map();

// providers get the stored book too, for sources that search by title
async function fetchAllProviders(isbn13, book) {
  const providers = enabledProviders();
  const results = await Promise.allSettled(
    providers.map((p) =>
      p.fetchOffers(isbn13, AbortSignal.timeout(PROVIDER_TIMEOUT_MS), book),
    ),
  );

  const offers = [];
  const sources = [];
  results.forEach((r, i) => {
    if (r.status === "fulfilled") {
      sources.push(providers[i].id);
      offers.push(...r.value);
    } else {
      console.error(`price provider ${providers[i].id} failed:`, r.reason);
    }
  });

  // only record a check if at least one source answered, so an outage
  // doesn't leave a volume looking "checked, nothing found" for six hours
  if (providers.length && sources.length) {
    await priceQueries.saveCheck(isbn13, sources, offers);
  }
  return { sources, attempted: providers.length };
}

async function refreshIfStale(isbn13, book) {
  const last = await priceQueries.getLastCheck(isbn13);
  const fresh =
    last && Date.now() - new Date(last.checked_at).getTime() < FRESH_FOR_MS;
  if (fresh || !enabledProviders().length) return;

  if (!inFlight.has(isbn13)) {
    inFlight.set(
      isbn13,
      fetchAllProviders(isbn13, book).finally(() => inFlight.delete(isbn13)),
    );
  }
  await inFlight.get(isbn13);
}

async function getOrCreateBook(isbn13) {
  const stored = await priceQueries.getBook(isbn13);
  if (stored) return stored;
  const found = await lookupIsbn(isbn13);
  if (!found) return null;
  await priceQueries.upsertBook(found);
  return priceQueries.getBook(isbn13);
}

export async function getVolumePrices(isbn13) {
  const book = await getOrCreateBook(isbn13);
  if (!book) return null;

  await refreshIfStale(isbn13, book);

  const last = await priceQueries.getLastCheck(isbn13);
  // a check and its samples share one transaction, so they share now()
  const [offers, stats] = await Promise.all([
    last ? priceQueries.getLatestOffers(isbn13, last.checked_at) : [],
    priceQueries.getPriceStats(isbn13),
  ]);

  const series = await getSeriesWithVolumes(seriesName(book.title));
  const volume = volumeOf(book.title);

  return {
    series: {
      name: series.name,
      slug: series.slug,
      info: series.info,
    },
    volume: isNaN(volume) ? null : volume,
    // the rest of the series, for the "from the same series" row
    siblings: series.volumes.filter((v) => v.isbn13 !== book.isbn13),
    book: {
      isbn13: book.isbn13,
      title: book.title,
      authors: book.authors,
      publisher: book.publisher,
      coverUrl: book.cover_url,
      year: book.year,
    },
    offers: offers.map((o) => ({
      store: o.store,
      format: o.format,
      condition: o.condition,
      priceCents: o.price_cents,
      currency: o.currency,
      inStock: o.in_stock,
      url: o.url,
      fetchedAt: o.fetched_at,
    })),
    stats: stats.samples
      ? {
          samples: stats.samples,
          lowCents: stats.low_cents,
          lowAt: stats.low_at,
          highCents: stats.high_cents,
          highAt: stats.high_at,
          avgCents: stats.avg_cents,
          medianCents: stats.median_cents,
          since: stats.since,
          lastSeen: stats.last_seen,
          changes: stats.changes,
        }
      : null,
    checkedAt: last?.checked_at ?? null,
    liveSources: enabledProviders().map((p) => p.store),
    storeLinks: storeLinks(isbn13),
  };
}

// ---------- series ----------

const SERIES_VOLUMES_FRESH_MS = 12 * 60 * 60 * 1000;
const seriesVolumesCache = new Map();

// every numbered volume of a series from the free catalog, one ISBN per
// volume number, cached half a day. Never spends a paid price search
async function seriesVolumes(name) {
  const key = seriesOf(name);
  const hit = seriesVolumesCache.get(key);
  if (hit && Date.now() - hit.at < SERIES_VOLUMES_FRESH_MS) return hit.volumes;

  // two free catalog queries merged: the plain one finds more, the quoted
  // title one is more precise. Long runners can have 100+ volumes
  const results = await Promise.allSettled([
    searchVolumes(name, { max: 250, timeoutMs: 20000 }),
    searchVolumes(`title:"${name.replace(/"/g, "")}"`, {
      max: 250,
      timeoutMs: 20000,
    }),
  ]);
  const found = results.flatMap((r) =>
    r.status === "fulfilled" ? r.value : [],
  );
  const failed = results.filter((r) => r.status === "rejected");
  failed.forEach((r) =>
    console.error("series volume lookup failed:", r.reason?.message),
  );

  const byNumber = new Map();
  for (const v of found) {
    if (seriesOf(v.title) !== key || v.volume === null) continue;
    if (!byNumber.has(v.volume)) byNumber.set(v.volume, v);
  }
  const volumes = [...byNumber.values()].sort((a, b) => a.volume - b.volume);

  // an answer hurt by a failed query is used once but not cached, so the next
  // visit tries again instead of showing a short list for half a day
  if (failed.length) return volumes.length ? volumes : (hit?.volumes ?? []);
  seriesVolumesCache.set(key, { at: Date.now(), volumes });
  if (seriesVolumesCache.size > 500) {
    seriesVolumesCache.delete(seriesVolumesCache.keys().next().value);
  }
  return volumes;
}

async function getSeriesWithVolumes(name) {
  const [info, mainVolumes] = await Promise.all([
    getSeriesInfo(name),
    seriesVolumes(name),
  ]);
  // a series can be sold under another name (Detective Conan -> Case Closed);
  // if the main name finds almost nothing, try the alternatives too
  let volumes = mainVolumes;
  if (volumes.length < 3 && info?.altNames?.length) {
    for (const alt of info.altNames.slice(0, 4)) {
      if (seriesOf(alt) === seriesOf(name)) continue;
      const altVolumes = await seriesVolumes(alt);
      if (altVolumes.length > volumes.length) volumes = altVolumes;
    }
  }
  const known = await priceQueries.getKnownPrices(volumes.map((v) => v.isbn13));
  return {
    name,
    slug: slugify(name),
    info,
    volumes: volumes.map((v) => ({
      isbn13: v.isbn13,
      title: v.title,
      volume: v.volume,
      coverUrl: v.coverUrl,
      knownPriceCents: known.get(v.isbn13)?.price_cents ?? null,
    })),
  };
}

export async function getSeries(name) {
  const series = await getSeriesWithVolumes(name);
  if (!series.info && !series.volumes.length) return null;
  return series;
}

export { searchSeries };

// ---------- price home ----------

// latest deals: volumes now cheaper than their own average, from prices we
// already have. Recently checked: the latest volumes anyone looked up
export async function getHighlights() {
  const [trending, recent] = await Promise.all([
    getTrending(),
    priceQueries.getRecentBestPrices(40),
  ]);
  const toCard = (r) => ({
    isbn13: r.isbn13.trim(),
    title: r.title,
    coverUrl: r.cover_url,
    priceCents: r.price_cents,
    avgCents: r.avg_cents,
    checkedAt: r.fetched_at,
  });
  const deals = recent
    .filter((r) => r.samples >= 2 && r.price_cents < r.avg_cents * 0.95)
    .sort((a, b) => a.price_cents / a.avg_cents - b.price_cents / b.avg_cents)
    .slice(0, 8)
    .map(toCard);
  return {
    trending,
    deals,
    recent: recent.slice(0, 12).map(toCard),
  };
}
