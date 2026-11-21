// The pages that aren't one volume or one series: the series index, link
// previews and crawler summaries, the deals page and the price home. Reads
// only what's stored. Part of the price service (service.ts lists the parts).
import { publicReviews } from "../reviews/reviews.js";
import {
  volumeHeading,
  titleVolume,
  shopName,
  isWellKnown,
} from "./volumeNames.js";
import { hasNoCover } from "../models/coversAndSitemap.js";
import priceQueries, { SHOWN_FOR_MS } from "../models/priceQueries.js";
import { prisma } from "../config/prisma.js";
import { englishAuthors } from "./sources/catalog.js";
import {
  getSeriesInfo,
  getTrending,
  knownSeriesName,
  listKnownSeries,
} from "./sources/anilist.js";
import { seriesName, seriesOfBook, slugify } from "./stores/match.js";
import { dropUnlikelyNew } from "./stores/retailers.js";
import { volumesKey } from "./volumesKey.js";
import { editionsKey } from "./editionSource.js";
import { realBooks } from "../util/shelf/realBooks.js";
import {
  countedBooks,
  reportChanges,
  withCountedBooks,
} from "../util/shelf/editionReports.js";
import type { EditionLine } from "./editionLines.js";
import { isCollection, type SeriesHit } from "./types.js";
import { publisherOf } from "./publishers.js";
import { isRebind, getSeries } from "./seriesService.js";
import { type KnownVolume, knownVolumesBySeries } from "./shelfService.js";

// ---------- series index ----------

// every series with volumes known, for the /series page: AniList's facts
// plus how many US volumes we know. A series someone only looked up, with no
// volume found yet, is a near-empty page: it joins once its list is built
// (the sitemap leaves it out the same way). Database and memory only
export async function getSeriesIndex() {
  const [series, bySeries] = await Promise.all([
    listKnownSeries(),
    knownVolumesBySeries(),
  ]);
  // one per volume number: the same volume is known under several ISBNs
  // (a rebind, a UK printing, another catalog's spelling), and counting
  // those said Naruto has 96 volumes
  const volumesKnown = (name: string) =>
    new Set(
      [...(bySeries.get(slugify(name))?.values() ?? [])]
        .map((v) => titleVolume(v.title))
        .filter((n) => n != null && Number.isInteger(n) && n >= 1),
    ).size;
  return series
    .map((info) => ({
      name: info.name,
      coverUrl: info.coverUrl,
      score: info.score,
      // only a few raters' mean: "Top rated" keeps it below the rest
      ...(info.fewRaters ? { fewRaters: true } : {}),
      popularityRank: info.popularityRank,
      genres: info.genres ?? [],
      status: info.status,
      volumes: info.volumes,
      knownVolumes: volumesKnown(info.name),
    }))
    .filter((entry) => entry.knownVolumes > 0);
}

// ---------- editions index ----------

// one edition line of a series, as the /editions page lists it: its real
// books (util/shelf/realBooks.ts, the series page's own rule) with what each
// holds, whether a catalog lists it or it's vouched for, and its date
type EditionsEntryLine = {
  key: string;
  label: string;
  spans: {
    number: number;
    from: number;
    to: number;
    listed: boolean;
    sure: boolean;
    published: string | null;
  }[];
};

// every series with an omnibus or deluxe line saved (editionSource.ts, beside
// its other lists), most popular first: the /editions page, its crawler text
// and the sitemap. Database and memory only, never a catalog
const EDITIONS_INDEX_MS = 10 * 60_000;
let editionsIndexKept: {
  at: number;
  // readers' reports and the owner's decisions as they stood: a new one
  // shows at once (util/shelf/editionReports.ts)
  changes: number;
  entries: Awaited<ReturnType<typeof readEditionsIndex>>;
} | null = null;
export async function getEditionsIndex(now = Date.now()) {
  if (
    editionsIndexKept &&
    now - editionsIndexKept.at < EDITIONS_INDEX_MS &&
    editionsIndexKept.changes === reportChanges()
  )
    return editionsIndexKept.entries;
  const changes = reportChanges();
  const entries = await readEditionsIndex();
  editionsIndexKept = { at: now, changes, entries };
  return entries;
}

async function readEditionsIndex() {
  const [rows, series, counted] = await Promise.all([
    prisma.seriesVolumes.findMany({
      where: { key: { endsWith: ":editions" } },
      select: { key: true, volumes: true },
    }),
    listKnownSeries(),
    countedBooks().catch(() => new Map()),
  ]);
  const linesByKey = new Map(
    rows.map((row) => [row.key, row.volumes as unknown as EditionLine[]]),
  );
  const entries = [];
  for (const info of series) {
    const stored = linesByKey.get(editionsKey(info.name));
    if (!Array.isArray(stored)) continue;
    // with the books readers' reports or the owner made count
    const saved = withCountedBooks(counted, info.name, stored);
    const lines: EditionsEntryLine[] = [];
    for (const line of saved) {
      // the real books (util/shelf/realBooks.ts), as the series page has
      // them; a line nothing lists or vouches for isn't shown at all
      if (!line.books?.some((book) => book.listed || book.sure)) continue;
      const books = realBooks(line.books);
      lines.push({
        key: line.key,
        label: line.label,
        spans: books.map((book) => ({
          number: book.number,
          from: Math.min(...book.volumes),
          to: Math.max(...book.volumes),
          listed: Boolean(book.listed),
          sure: Boolean(book.sure),
          published: book.published ?? null,
        })),
      });
    }
    if (!lines.length) continue;
    entries.push({
      name: info.name,
      slug: slugify(info.name),
      coverUrl: info.coverUrl,
      popularityRank: info.popularityRank,
      lines,
    });
  }
  return entries.sort(
    (a, b) =>
      (a.popularityRank ?? Infinity) - (b.popularityRank ?? Infinity) ||
      a.name.localeCompare(b.name),
  );
}

// ---------- link previews ----------

// what a shared link's preview needs, from the database alone: no catalog,
// no store APIs, so the site's preview server can ask on every page load
export async function getVolumeSummary(isbn13: string) {
  const book = await priceQueries.getBook(isbn13);
  if (!book) return null;
  const [stored, usual] = await Promise.all([
    priceQueries.getCurrentOffers(isbn13),
    priceQueries.getNewPriceMedian(isbn13),
  ]);
  const offers = dropUnlikelyNew(stored, usual);
  // box sets and omnibuses are listed on the page, but aren't this volume's price
  const inStock = offers.filter((o) => o.inStock && !isCollection(o));
  const newPrint = inStock.filter(
    (o) => o.condition === "new" && o.format === "print",
  );
  const bestNew = inStock.find(
    (o) => o.condition === "new" && o.format === "print",
  );
  const [series, saved, [coverRow]] = await Promise.all([
    getSeriesInfo(seriesOfBook(book.title)).catch(() => null),
    priceQueries.getSavedVolume(isbn13).catch(() => null),
    priceQueries.getCoverIds([isbn13]).catch(() => []),
  ]);
  const seriesLabel = series?.name ?? seriesOfBook(book.title);
  return {
    isbn13: book.isbn13.trim(),
    title: book.title,
    // what the page is called (the address stays on the title)
    heading: volumeHeading(book.title, seriesLabel, saved),
    // saved before englishAuthors: "尾田栄一郎" alone shows none
    authors:
      englishAuthors(book.authors?.split(/,\s*/)) ??
      (series?.authors?.join(", ") || null),
    publisher: publisherOf(book.isbn13, { work: [book.publisher] }),
    year: book.year,
    // an edition we know has no cover: none, so previews and search engines
    // get the series' picture instead of an image address that answers 404
    coverUrl: hasNoCover(coverRow) ? null : book.coverUrl,
    seriesName: series?.name ?? seriesOfBook(book.title),
    seriesCoverUrl: series?.coverUrl ?? null,
    // stores people know first; `knownStores` is just those, for search
    // results, where "at nuclearwaste" reads as spam
    stores: [...new Set(offers.map((o) => o.store))].sort(
      (a, b) => Number(isWellKnown(b)) - Number(isWellKnown(a)),
    ),
    // stores, counting a big store's sellers as the store
    storeCount: new Set(offers.map((o) => shopName(o.store))).size,
    knownStores: [
      ...new Set(
        offers
          .map((o) => o.store)
          .filter(isWellKnown)
          .map(shopName),
      ),
    ],
    // the range search engines get (AggregateOffer): new print copies only,
    // as the page's "New from" line says. An ebook or a used copy made it
    // read $6.99 to $69.99 beside "New from $11.77"
    lowCents: newPrint[0]?.priceCents ?? null,
    highCents: newPrint.at(-1)?.priceCents ?? null,
    offerCount: newPrint.length,
    bestNew: bestNew
      ? {
          store: bestNew.store,
          priceCents: bestNew.priceCents,
          // the name to show in a search result, when it's one people know
          known: isWellKnown(bestNew.store) ? shopName(bestNew.store) : null,
        }
      : null,
    published: saved?.published ?? null,
    pages: saved?.pages ?? null,
    // readers' rating, and the reviews anyone may be shown (never a spoiler)
    reviews: await publicReviews(book.isbn13.trim()).catch(() => null),
    seriesDescription: series?.description ?? null,
    ...(await nearbyVolumes(isbn13, book.title, seriesLabel)),
    // the stored prices, cheapest first, written into the page for crawlers
    offers: inStock.slice(0, SUMMARY_OFFERS).map((o) => ({
      store: o.store,
      condition: o.condition,
      format: o.format,
      priceCents: o.priceCents,
    })),
  };
}

const SUMMARY_OFFERS = 12;

const NEARBY_VOLUMES = 12;

// the volumes around this one in its series, from what's known (memory and
// database only): the one before and after, and a dozen nearest by number,
// for the page's links. One volume per number
async function nearbyVolumes(isbn13: string, title: string, series: string) {
  const bySeries = await knownVolumesBySeries().catch(() => null);
  const byNumber = new Map<number, KnownVolume>();
  for (const key of new Set([slugify(series), slugify(seriesName(title))])) {
    for (const v of bySeries?.get(key)?.values() ?? []) {
      const n = titleVolume(v.title);
      if (n == null) continue;
      // this volume itself wins its number
      if (!byNumber.has(n) || v.isbn13.trim() === isbn13) byNumber.set(n, v);
    }
  }
  // this page's own book holds its number, even an edition the series' list
  // passed over (a rebind someone opened)
  const own = titleVolume(title);
  if (own != null) byNumber.set(own, { isbn13, title });
  const list = [...byNumber.entries()]
    .sort(([a], [b]) => a - b)
    .map(([volume, v]) => ({
      isbn13: v.isbn13.trim(),
      title: v.title,
      volume,
    }));
  const at = list.findIndex((v) => v.isbn13 === isbn13);
  if (at === -1) return { prev: null, next: null, nearby: [] };
  const nearby = list
    .filter((_, i) => i !== at)
    .map((v, i) => ({ v, d: Math.abs(i + (i >= at ? 1 : 0) - at) }))
    .sort((a, b) => a.d - b.d)
    .slice(0, NEARBY_VOLUMES)
    .map(({ v }) => v)
    .sort((a, b) => a.volume - b.volume);
  return { prev: list[at - 1] ?? null, next: list[at + 1] ?? null, nearby };
}
const SUMMARY_VOLUMES = 200;

export async function getSeriesSummary(asked: string) {
  const name = await knownSeriesName(asked);
  const info = await getSeriesInfo(name).catch(() => null);
  if (!info) return null;
  // the volumes we know, with the lowest new price we already have: memory
  // and database only, like the shelf
  const bySeries = await knownVolumesBySeries().catch(() => null);
  const known = new Map<string, KnownVolume>();
  for (const key of new Set([slugify(info.name), slugify(seriesName(asked))])) {
    bySeries?.get(key)?.forEach((v, isbn) => known.set(isbn, v));
  }
  // one per volume number: the same volume turns up under several ISBNs and
  // spellings ("ONE PIECE 28", "One Piece, Vol. 28", a library rebind). The
  // publisher's edition first, then one with a price. A book with no number
  // (a guidebook) isn't one of the run
  const candidates = [...known.values()].filter(
    (v) => titleVolume(v.title) != null,
  );
  const prices = await priceQueries
    .getKnownPrices(candidates.map((v) => v.isbn13.trim()))
    .catch(() => new Map<string, { priceCents: number }>());
  const rank = (v: KnownVolume) =>
    (isRebind(v.isbn13) ? 2 : 0) + (prices.has(v.isbn13.trim()) ? 0 : 1);
  const byNumber = new Map<number, KnownVolume>();
  for (const v of candidates) {
    const n = titleVolume(v.title)!;
    const had = byNumber.get(n);
    if (!had || rank(v) < rank(had)) byNumber.set(n, v);
  }
  const volumes = [...byNumber.entries()]
    .sort(([a], [b]) => a - b)
    .map(([, v]) => v)
    .slice(0, SUMMARY_VOLUMES);
  // its omnibus and deluxe lines as saved, book by book: which volumes each
  // holds, for the crawler text's "Other editions" (database only)
  const savedLines = await prisma.seriesVolumes
    .findUnique({
      where: { key: editionsKey(info.name) },
      select: { volumes: true },
    })
    .catch(() => null);
  const editions = withCountedBooks(
    await countedBooks().catch(() => new Map()),
    info.name,
    Array.isArray(savedLines?.volumes)
      ? (savedLines.volumes as unknown as EditionLine[])
      : [],
  )
    .map((line) => ({
      key: line.key,
      label: line.label,
      // the real books (util/shelf/realBooks.ts), as the series page has them
      books: realBooks(line.books ?? []).map((book) => ({
        number: book.number,
        volumes: book.volumes,
        listed: Boolean(book.listed),
        sure: Boolean(book.sure),
        published: book.published ?? null,
      })),
    }))
    .filter((line) => line.books.length);
  return {
    name: info.name,
    editions,
    description: info.description,
    coverUrl: info.coverUrl,
    genres: info.genres,
    volumes: volumes.map((v) => ({
      isbn13: v.isbn13.trim(),
      title: v.title,
      volume: titleVolume(v.title),
      // a preorder is listed, but not in what the series costs today
      published: v.published ?? null,
      fromCents: prices.get(v.isbn13.trim())?.priceCents ?? null,
    })),
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

// the /deals page: volumes now well under their usual new price, the same
// believable price each volume's page shows (a fake one never headlines),
// each with its series' cover for one without its own
export async function getDealsPage() {
  const rows = await priceQueries.getDeals(DEALS_SHOWN * 2);
  const known = await priceQueries.getKnownPrices(
    rows.map((r) => r.isbn13.trim()),
  );
  const deals = rows
    .flatMap((r) => {
      const price = known.get(r.isbn13.trim());
      return price && price.priceCents < r.avgCents * 0.9
        ? [{ ...r, priceCents: price.priceCents }]
        : [];
    })
    .sort((a, b) => a.priceCents / a.avgCents - b.priceCents / b.avgCents)
    .slice(0, DEALS_SHOWN);
  const names = [...new Set(deals.map((r) => seriesOfBook(r.title)))];
  const infos = await Promise.all(
    names.map((name) => getSeriesInfo(name).catch(() => null)),
  );
  const covers = new Map(names.map((n, i) => [n, infos[i]?.coverUrl ?? null]));
  return deals.map((r) => ({
    isbn13: r.isbn13.trim(),
    title: r.title,
    volume: titleVolume(r.title),
    coverUrl: r.coverUrl,
    seriesCoverUrl: covers.get(seriesOfBook(r.title)) ?? null,
    priceCents: r.priceCents,
    avgCents: r.avgCents,
    checkedAt: r.fetchedAt,
  }));
}
const DEALS_SHOWN = 48;

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
    ...new Set([...dealRows, ...recentRows].map((r) => seriesOfBook(r.title))),
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
    seriesCoverUrl: seriesCovers.get(seriesOfBook(r.title)) ?? null,
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

// ---------- the About page's count ----------

// How many volumes have a price found in the last 30 days, US or Canada:
// "12,345 volumes priced". A real in-stock price, not just a look (a store
// saying "we don't have it" is a look). Only recent ones, so it stays true
// as old prices age out (priceAge.ts). Worked out at most once an hour
const PRICED_COUNT_MS = 60 * 60_000;
let pricedCount: { at: number; volumes: number } | null = null;

export async function getPricedCount(now = Date.now()) {
  if (pricedCount && now - pricedCount.at < PRICED_COUNT_MS)
    return pricedCount.volumes;
  const since = new Date(now - SHOWN_FOR_MS);
  const rows = await prisma.$queryRaw<{ volumes: bigint }[]>`
    SELECT COUNT(*) AS volumes FROM (
      SELECT isbn13 FROM price_samples
      WHERE fetched_at > ${since} AND in_stock
      UNION
      SELECT isbn13 FROM ca_price_samples
      WHERE fetched_at > ${since} AND in_stock
    ) priced
  `;
  pricedCount = { at: now, volumes: Number(rows[0]?.volumes ?? 0) };
  return pricedCount.volumes;
}
