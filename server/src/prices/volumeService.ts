// One volume's prices: which sources are due a check, running them, saving
// what they say, and the page's data (offers, history, series, siblings).
// Only this file can spend a paid search, and at most once per volume every
// FRESH_FOR_MS. Part of the price service (service.ts lists the parts).
import { volumeHeading, titleVolume, isWellKnown } from "./volumeNames.js";
import priceQueries, { type Book } from "../models/priceQueries.js";
import { englishAuthors, lookupIsbn } from "./sources/catalog.js";
import { isNovelBook, seriesName } from "./stores/match.js";
import { enabledProviders } from "./providers/index.js";
import { ebayCallsLeft } from "./providers/ebay.js";
import { cjCallsLeft } from "./providers/booksAMillion.js";
import { serpApiSearchesLeft } from "./providers/serpapiClient.js";
import { SearchesUsedUp } from "./providers/serpapiKeys.js";
import {
  affiliateOfferUrl,
  isAffiliateUrl,
  preferDirectRows,
  storeLinks,
  storeName,
} from "./stores/storeLinks.js";
import { dropUnlikelyNew, unlikelyNewTest } from "./stores/retailers.js";
import { isNovelName } from "./lightNovel.js";
import { type Offer, type Provider } from "./types.js";
import { notOutYet } from "./preorder.js";
import { publisherOf } from "./publishers.js";
import { getSeriesWithVolumes } from "./seriesService.js";

// prices are re-fetched at most this often per volume; in between, people
// see the stored ones. 20 days: volume prices move slowly, every page offers
// several stores, and the free SerpApi allowance runs out in days at less
const FRESH_FOR_MS = 20 * 24 * 60 * 60 * 1000;
const PROVIDER_TIMEOUT_MS = 12000;

// ---------- one volume ----------

// one fetch per ISBN at a time, even if several people open it at once
const inFlight = new Map<string, Promise<unknown>>();

// asks every enabled provider at once; one failing doesn't stop the others
// Google Shopping (one paid search covering many stores) is asked only when
// the stores asked directly found no print copy: most checks then spend one
// paid search fewer. Ebooks don't count, Google Play only has those
const GOOGLE_SHOPPING = "serpapi";
export const needsGoogleShopping = (offers: Pick<Offer, "format">[]) =>
  !offers.some((o) => o.format === "print");

// ---------- source groups ----------

// Each price source belongs to a group, and each group checks a volume on its
// own schedule: eBay (free with eBay's own API) every few days, the paid
// searches every few weeks. eBay through SerpApi and eBay's API share a group,
// so switching between them keeps the prices
const GROUP_OF: Record<string, string> = {
  serpapi: "shopping",
  "serpapi-ebay": "ebay",
  ebay: "ebay",
  "serpapi-amazon": "amazon",
  keepa: "amazon",
  "google-books": "ebooks",
  walmart: "walmart",
};
export const groupOf = (provider: Pick<Provider, "id">) =>
  GROUP_OF[provider.id] ?? provider.id;

const DAY_MS = 24 * 60 * 60 * 1000;
// by provider, not group: eBay's own API is free, so it looks every few days;
// eBay through SerpApi is a paid search, so it keeps to the 20 days.
// Books-A-Million through CJ and Better World Books through Impact are free
// too: as often as eBay's
const FRESH_FOR_PROVIDER_MS: Record<string, number> = {
  ebay: 3 * DAY_MS,
  "books-a-million": 3 * DAY_MS,
  "better-world-books": 3 * DAY_MS,
};
export const freshForMs = (provider: Pick<Provider, "id">) =>
  FRESH_FOR_PROVIDER_MS[provider.id] ?? FRESH_FOR_MS;

const isPaid = (provider: Pick<Provider, "id">) =>
  provider.id.startsWith("serpapi");

// the enabled providers whose group's last look at this volume is old enough,
// or never happened. Paid ones only while a search is left this month, and
// eBay's own only while today's calls last: without them they'd only fail,
// and the volume would look due forever
async function dueProviders(isbn13: string): Promise<Provider[]> {
  const [checks, searchesLeft, ebayLeft, cjLeft] = await Promise.all([
    priceQueries.getSourceChecks(isbn13),
    serpApiSearchesLeft().catch(() => true),
    ebayCallsLeft().catch(() => true),
    cjCallsLeft().catch(() => true),
  ]);
  const now = Date.now();
  return enabledProviders().filter((p) => {
    if (isPaid(p) && !searchesLeft) return false;
    // eBay's own API with today's calls used up: not due until tomorrow
    if (p.id === "ebay" && !ebayLeft) return false;
    if (p.id === "books-a-million" && !cjLeft) return false;
    if (failedRecently(isbn13, p)) return false;
    const at = checks.get(groupOf(p));
    return !at || now - at.getTime() >= freshForMs(p);
  });
}

// A provider that failed for a volume (timed out, an error) waits a while
// before trying it again, so a source that keeps failing for one ISBN can't
// run (and maybe spend a paid search) on every page view. In memory: a
// restart only means one more try
const FAILED_WAIT_MS = DAY_MS;
const failures = new Map<string, number>();
const failureKey = (isbn13: string, p: Pick<Provider, "id">) =>
  `${isbn13}|${p.id}`;
const failedRecently = (isbn13: string, p: Pick<Provider, "id">) => {
  const at = failures.get(failureKey(isbn13, p));
  return at !== undefined && Date.now() - at < FAILED_WAIT_MS;
};
const noteFailure = (isbn13: string, p: Pick<Provider, "id">) => {
  failures.delete(failureKey(isbn13, p));
  failures.set(failureKey(isbn13, p), Date.now());
  if (failures.size > 10_000) failures.delete(failures.keys().next().value!);
};

// asks the due providers at once; one failing doesn't stop the others.
// Google Shopping (one paid search covering many stores) is asked only when
// neither this round nor the other groups' current prices have a print copy
// (its own old prices don't count: they're what it's due to look at again);
// when it isn't needed it counts as looked at, so it isn't due again before
// its time. Only groups that answered get their prices replaced; one that
// failed, wasn't due or ran out of searches keeps its own. Nothing is saved
// unless a source really answered
export async function fetchProviders(
  isbn13: string,
  book: Book,
  due: Provider[],
  // a check nobody asked for (collector/filler.ts): marked "fill" in
  // price_checks, so the home page's "recently checked" leaves it out
  {
    background = false,
    // Leave every store that isn't asked exactly as it is. For scripts run
    // from a laptop: the tidy-up below clears a store's old prices when no
    // provider "serves it any more", and a laptop missing production's keys
    // would see every such store that way
    onlyThese = false,
  }: { background?: boolean; onlyThese?: boolean } = {},
) {
  const first = due.filter((p) => p.id !== GOOGLE_SHOPPING);
  const shopping = due.find((p) => p.id === GOOGLE_SHOPPING);
  const groups = new Map<string, Offer[]>();
  const sources: string[] = [];

  const ask = async (list: Provider[]) => {
    const results = await Promise.allSettled(
      list.map((p) =>
        p.fetchOffers(isbn13, AbortSignal.timeout(PROVIDER_TIMEOUT_MS), book),
      ),
    );
    results.forEach((r, i) => {
      const provider = list[i]!;
      if (r.status === "fulfilled") {
        sources.push(provider.id);
        const group = groupOf(provider);
        groups.set(group, [...(groups.get(group) ?? []), ...r.value]);
      } else if (!(r.reason instanceof SearchesUsedUp)) {
        noteFailure(isbn13, provider);
        console.error(`price provider ${provider.id} failed:`, r.reason);
      }
    });
  };
  await ask(first);

  // what's still current from the groups not answering this round
  const current = await priceQueries.getCurrentRows(isbn13);
  const kept = current.filter((o) => !groups.has(o.source));
  // this volume's usual new price, for judging what's found (read once)
  const usual = await priceQueries.getNewPriceMedian(isbn13);
  if (shopping) {
    // only print copies someone could buy and that we'd show count: an
    // out-of-stock one, or a "new" price we'd drop, doesn't make it not needed
    const fresh = [...groups.values()].flat();
    const others = kept.filter((o) => o.source !== groupOf(shopping));
    const buyable = [...fresh, ...others].filter((o) => o.inStock);
    const unbelievable = unlikelyNewTest(buyable, usual);
    if (needsGoogleShopping(buyable.filter((o) => !unbelievable(o))))
      await ask([shopping]);
    else groups.set(groupOf(shopping), []);
  }
  // nothing answered and nothing decided (an outage, searches out): nothing is
  // recorded, so every group keeps the prices it last found. Google Shopping
  // found not needed is still recorded, so it isn't due on every view
  if (!sources.length && !groups.size) return;

  // a group no enabled provider serves any more (its keys were removed, or the
  // migration sorted an old row into it) is cleared once it's past its time,
  // so its prices can't stay up for ever
  const served = new Set(enabledProviders().map(groupOf));
  const checks = await priceQueries.getSourceChecks(isbn13);
  for (const [group, at] of checks) {
    const abandoned =
      !served.has(group) && Date.now() - at.getTime() >= FRESH_FOR_MS;
    if (abandoned && !onlyThese) groups.set(group, []);
  }

  // judged against this volume's usual new price and against every price
  // that will be current alongside them (the other groups' too), so an
  // eBay-only check still drops a "new" copy far above the big stores'
  // stores saved under one name each, as they're shown
  const fresh = [...groups].map(
    ([group, offers]) =>
      [
        group,
        preferDirectRows(offers).map((o) => ({
          ...o,
          store: storeName(o.store),
        })),
      ] as const,
  );
  const alongside = [
    ...fresh.flatMap(([, offers]) => offers),
    ...kept.filter((o) => !groups.has(o.source)),
  ];
  const unlikely = unlikelyNewTest(alongside, usual);
  const judged = new Map(
    fresh.map(([group, offers]) => [group, offers.filter((o) => !unlikely(o))]),
  );
  await priceQueries.saveCheck(
    isbn13,
    background ? [...sources, "fill"] : sources,
    judged,
  );
}

// a live check: only the providers that are due look again. Answers with the
// last check when nothing was due, so the caller needn't read it again
// What's due is worked out inside the one-at-a-time lock, so two visitors
// opening the same volume can't both start the same (maybe paid) check
// runs a check of a volume unless one is already under way (a page visit's
// or another): false when it didn't run. For the background pricing
export async function checkAlone(isbn13: string, run: () => Promise<unknown>) {
  if (inFlight.has(isbn13)) return false;
  const running = run().finally(() => inFlight.delete(isbn13));
  inFlight.set(isbn13, running);
  await running;
  return true;
}

async function refreshIfStale(isbn13: string, book: Book) {
  if (!inFlight.has(isbn13)) {
    inFlight.set(
      isbn13,
      (async () => {
        const due = await dueProviders(isbn13);
        if (due.length) await fetchProviders(isbn13, book, due);
      })().finally(() => inFlight.delete(isbn13)),
    );
  }
  await inFlight.get(isbn13);
}

// the stored book, or the catalog's answer stored for next time. A series
// list that holds this ISBN has the last word on its name and format: it saw
// the English edition (where the ISBN's own record can be Japanese) and told
// the novel from the manga by length. A book stored under the other format is
// renamed to match
// where a volume page finds its book first: stored, or in a series list
const storedOrSaved = (isbn13: string) =>
  Promise.all([
    priceQueries.getBook(isbn13),
    priceQueries.getSavedVolume(isbn13).catch(() => null),
  ]);

export async function getOrCreateBook(isbn13: string) {
  const [stored, saved] = await storedOrSaved(isbn13);
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
//
// Remembered a day, and a failure a few minutes (as a throw), so crawlers
// walking unknown ISBNs can't keep Open Library busy: a burst of lookups
// gets the whole server blocked there, covers included
const EXISTS_MS = 24 * 60 * 60 * 1000;
const EXISTS_FAILED_MS = 5 * 60 * 1000;
const EXISTS_MAX = 5000;
const existsCache = new Map<
  string,
  { at: number; ttl: number; answer: boolean | null }
>();

// and at most so many catalog lookups a minute for the whole server: past
// that the answer is "don't know" (the page stays up), so many different
// unknown ISBNs can't queue up Open Library for everyone else
const EXISTS_LOOKUPS_PER_MIN = 20;
let existsLookups: number[] = [];

export async function volumeExists(isbn13: string): Promise<boolean> {
  // stored or listed now counts at once, whatever was remembered before
  const [stored, saved] = await storedOrSaved(isbn13);
  if (stored || saved) return true;
  const hit = existsCache.get(isbn13);
  if (hit && Date.now() - hit.at < hit.ttl) {
    if (hit.answer === null) throw new Error("catalog unavailable");
    return hit.answer;
  }
  const remember = (answer: boolean | null, ttl: number) => {
    existsCache.delete(isbn13);
    existsCache.set(isbn13, { at: Date.now(), ttl, answer });
    if (existsCache.size > EXISTS_MAX)
      existsCache.delete(existsCache.keys().next().value!);
  };
  const now = Date.now();
  existsLookups = existsLookups.filter((t) => now - t < 60_000);
  if (existsLookups.length >= EXISTS_LOOKUPS_PER_MIN)
    throw new Error("too many catalog lookups right now");
  existsLookups.push(now);
  try {
    const answer = Boolean(await lookupIsbn(isbn13));
    remember(answer, EXISTS_MS);
    return answer;
  } catch (e) {
    remember(null, EXISTS_FAILED_MS);
    throw e;
  }
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

// when a volume's prices were checked: the oldest of its source checks (as
// shelf and series prices and the home page say), so an eBay look every few
// days doesn't make 20-day-old store prices read as fresh. Before sources
// were timed apart, the last check of any kind
async function pricesCheckedAt(isbn13: string) {
  const [lastCheck, sourceChecks] = await Promise.all([
    priceQueries.getLastCheck(isbn13),
    priceQueries.getSourceChecks(isbn13),
  ]);
  const times = [...sourceChecks.values()].map((at) => at.getTime());
  return times.length ? new Date(Math.min(...times)) : lastCheck?.checkedAt;
}

// the rest of a series' books, each once: a book holding two volumes is
// listed under both numbers
function otherBooksOf<T extends { isbn13: string }>(
  volumes: T[],
  thisIsbn: string,
) {
  const seen = new Set([thisIsbn]);
  return volumes.filter((v) => {
    if (seen.has(v.isbn13)) return false;
    seen.add(v.isbn13);
    return true;
  });
}

// `refresh: false` shows what's stored without fetching new prices (crawlers)
// `refresh`: a live check may run. `report`: say whether one would (the
// page's "refreshable"); crawlers never run one, so they're spared asking
export async function getVolumePrices(
  isbn13: string,
  { refresh = true, report = true } = {},
) {
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
  if (refresh && known && !preorder) await refreshIfStale(isbn13, book);

  const [checkedAt, [coverRow]] = await Promise.all([
    pricesCheckedAt(isbn13),
    priceQueries.getCoverIds([isbn13]).catch(() => []),
  ]);
  // whether a live check (with Turnstile) would look again: the page shows
  // these stored prices first and only asks for one when it would
  const refreshable =
    report && known && !preorder && (await dueProviders(isbn13)).length > 0;
  const [stored, usual] = await Promise.all([
    priceQueries.getCurrentOffers(isbn13),
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
  const listed = series.volumes.find((v) => v.isbn13.trim() === book.isbn13);
  return {
    refreshable,
    heading: volumeHeading(
      book.title,
      series.info?.name ?? series.name,
      listed,
    ),
    series: { name: series.name, slug: series.slug, info: series.info },
    volume: inBook ? null : titleVolume(book.title),
    inBook,
    // its release date, when it isn't out yet
    preorder,
    // the rest of the series, for the "from the same series" row: each book
    // once, though it holds two volumes
    siblings: otherBooksOf(series.volumes, book.isbn13),
    book: {
      isbn13: book.isbn13,
      title: book.title,
      // saved before englishAuthors: "尾田栄一郎" alone shows none
      authors:
        englishAuthors(book.authors?.split(/,\s*/)) ??
        (series.info?.authors?.join(", ") || null),
      // saved before publisherOf: a foreign edition's publisher is fixed here
      publisher: publisherOf(book.isbn13, { work: [book.publisher] }),
      // an edition known to have no cover: none, as the preview tags have it,
      // so the page (and its tags) never point at an image that answers 404
      coverUrl: coverRow && coverRow.coverId === null ? null : book.coverUrl,
      year: book.year,
    },
    offers: offers.map((o) => {
      const url = affiliateOfferUrl(o, isbn13);
      // a store readers know by name: the page points out the cheapest of
      // these when the cheapest overall is a seller nobody has heard of
      return {
        ...o,
        url,
        affiliate: isAffiliateUrl(url),
        knownStore: isWellKnown(o.store),
      };
    }),
    // only once there's been a check, when it has a first and last date
    history:
      history.checks && history.since && history.lastSeen
        ? { ...history, since: history.since, lastSeen: history.lastSeen }
        : null,
    checkedAt: checkedAt ?? null,
    liveSources: enabledProviders().map((p) => p.store),
    storeLinks: storeLinks(isbn13),
  };
}
