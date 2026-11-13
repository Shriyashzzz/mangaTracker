// A series' list of volumes: asked of the catalogs, merged into one list,
// saved, and read back for the series page. Part of the price service
// (service.ts lists the parts).
import { titleVolume } from "./volumeNames.js";
import { savedBoxSets } from "./boxSetScan.js";
import priceQueries from "../models/priceQueries.js";
import { searchVolumesDetailed } from "./sources/catalog.js";
import { getSeriesInfo, knownSeriesName } from "./sources/anilist.js";
import {
  isSingleVolume,
  normalize,
  seriesOf,
  slugify,
} from "./stores/match.js";
import {
  affiliateOfferUrl,
  isAffiliateUrl,
  boxSetLinks,
  storeName,
} from "./stores/storeLinks.js";
import { editionCoverId } from "./sources/covers.js";
import { baseName, isNovelName, novelName } from "./lightNovel.js";
import { volumesKey } from "./volumesKey.js";
import { type CatalogBook, type SeriesInfo } from "./types.js";
import {
  googleSeriesVolumes,
  googleVolume,
} from "./sources/googleBooksCatalog.js";
import { notOutYet } from "./preorder.js";
import { forgetKnownVolumes } from "./shelfService.js";

// ---------- series ----------

const SERIES_VOLUMES_FRESH_MS = 12 * 60 * 60 * 1000;
// with a saved list to show, the catalog being down can wait this long before
// anyone sits through asking it again
const SERIES_VOLUMES_RETRY_MS = 10 * 60 * 1000;
export const seriesVolumesCache = new Map<
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
    // a volume sold on its own is never swapped for the book holding it,
    // nor the publisher's edition for a library rebind
    if (v.inBook && had && !had.inBook) continue;
    if (had && isRebind(v.isbn13) && !isRebind(had.isbn13)) continue;
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

// library rebinds of a publisher's paperback: Turtleback (978-1-417,
// 978-0-606) and Tandem Library (978-0-613). Same pages in a hard library
// cover at three times the price, and often another edition's cover image
// (One Piece 8, 10 and 17 were listed under these). The publisher's own
// edition of a volume always wins over one
// Gollancz's UK printing (978-0-575, Detective Conan 3, 6, 8 and 9) is the
// same: the US publisher's own wins when a catalog has it, and it counts as
// a volume to look up again (gapVolumes)
const REBIND = /^(9781417|9780606|9780613|9780575)/;
export const isRebind = (isbn13: string) => REBIND.test(isbn13.trim());
// the edition a volume should be listed under: a lone volume over a book
// holding it, the publisher's over a rebind
const betterEdition = (had: CatalogBook, v: CatalogBook) =>
  (had.inBook && !v.inBook) ||
  (isRebind(had.isbn13) && !isRebind(v.isbn13) && !v.inBook);

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
  if (!had || betterEdition(had, v)) byNumber.set(v.volume, v);
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
// a manga "volume" this long is an omnibus holding three: single volumes run
// about 130 to 250 pages, a 3-in-1 about 580 to 630. Light novels are left
// alone, some of them run long
const OMNIBUS_PAGES = 500;
export const isOmnibusLength = (v: Pick<CatalogBook, "pages" | "inBook">) =>
  !v.inBook && (v.pages ?? 0) >= OMNIBUS_PAGES;
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
  // past its time but there: shown now, looked up again in the background.
  // A rebuild takes the catalogs 10 to 20 seconds, which a visitor (or a
  // search engine) shouldn't sit through twice a day per series
  if (hit?.volumes.length) {
    if (!rebuilding.has(key)) {
      rebuilding.set(
        key,
        lookUpSeriesVolumes(name, { searchAs, google }, key, hit, freshFor)
          .catch((e: Error) =>
            console.error("series volume rebuild failed:", e.message),
          )
          .finally(() => rebuilding.delete(key)),
      );
    }
    return {
      volumes: hit.volumes.filter(
        (v) => isNovelName(name) || !isOmnibusLength(v),
      ),
      incomplete: false,
    };
  }
  return lookUpSeriesVolumes(name, { searchAs, google }, key, hit, freshFor);
}

// series lists being looked up again in the background, one at a time each
const rebuilding = new Map<string, Promise<unknown>>();

async function lookUpSeriesVolumes(
  name: string,
  { searchAs, google = false }: { searchAs?: string; google?: boolean },
  key: string,
  hit: { at: number; volumes: CatalogBook[] } | null,
  freshFor: number,
): Promise<{ volumes: CatalogBook[]; incomplete: boolean }> {
  const series = seriesOf(name);
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
    // nor a 3-in-1 omnibus numbered like one ("One Piece, Vol. 5 (It's All
    // Right!!! / Instinct / Straight Ahead!!!)", 584 pages): its price and
    // cover aren't the volume's
    if (!novel && isOmnibusLength(v)) continue;
    addVolume(byNumber, v, books, datedElsewhere);
  }
  adoptUpcomingDates(byNumber, datedElsewhere);
  const volumes = mergeVolumes(
    // lists saved before this rule lose theirs too
    (hit?.volumes ?? []).filter((v) => novel || !isOmnibusLength(v)),
    [...byNumber.values()],
  );

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

// ---------- volumes the series searches missed ----------

// numbered gaps below the highest known volume, and volumes whose only
// edition is a library rebind, asked for one at a time (googleVolume). A
// series asks about a few a day, in turn, and what's found is saved and kept,
// so its gaps close over the days; the site asks a capped number a day, out
// of Google Books' ~1,000
const GAPS_PER_SERIES = 8;
const GAP_LOOKUPS_A_DAY = 150;
const GAPS_ASKED_MS = 24 * 60 * 60 * 1000;
const gapDay = () => new Date().toISOString().slice(0, 10);

async function gapVolumes(
  name: string,
  byNumber: Map<number | null, CatalogBook>,
): Promise<CatalogBook[]> {
  const key = `${volumesKey(name)}:gaps`;
  const saved = await priceQueries.getSeriesVolumes(key).catch(() => null);
  const had = saved?.volumes ?? [];
  // asked at most once a day; what was found is kept and added to
  if (saved && Date.now() - saved.at < GAPS_ASKED_MS) return had;
  const numbers = [...byNumber.keys()].filter(
    (n): n is number => n != null && Number.isInteger(n) && n >= 1,
  );
  const highest = Math.max(0, ...numbers);
  const known = new Set(had.map((b) => titleVolume(b.title)));
  const gaps: number[] = [];
  for (let n = 1; n <= highest; n++) {
    const was = byNumber.get(n);
    if ((!was || isRebind(was.isbn13)) && !known.has(n)) gaps.push(n);
  }
  if (!gaps.length) return had;
  // a few a day, in turn, so a long series with many gaps (Detective Conan)
  // is worked through over the days rather than asking the same ones again
  const day = gapDay();
  const turn = Math.floor(Date.parse(day) / 86_400_000);
  const start = (turn * GAPS_PER_SERIES) % gaps.length;
  const wanted = [...gaps.slice(start), ...gaps.slice(0, start)].slice(
    0,
    GAPS_PER_SERIES,
  );
  const found: CatalogBook[] = [...had];
  for (const n of wanted) {
    const allowed = await priceQueries
      .claimApiCall(`gbgap:${day}`, GAP_LOOKUPS_A_DAY, `${day.slice(0, 7)}-01`)
      .catch(() => false);
    // the day's share used: what was found so far, asked again another day
    if (!allowed) break;
    const book = await googleVolume(name, n).catch(() => null);
    if (book && !isRebind(book.isbn13) && !isOmnibusLength(book))
      found.push({ ...book, title: `${name}, Vol. ${n}` });
  }
  await priceQueries.saveSeriesVolumes(key, found).catch(() => {});
  return found;
}

// ---------- one list for the whole site ----------

// The series page's list is the careful one: every catalog's answer merged,
// the publisher's edition over a rebind or UK printing, gaps filled, no
// 3-in-1 standing in for a volume. It's saved as it's built, and the shelf
// tools (collector/shelfSeries.ts), the index, sitemap, fillers and link
// previews (knownVolumesBySeries) all read that one list, so they can't
// disagree with the page about which book is vol. 8. A series whose page
// hasn't been built since this was added falls back to the raw lists
export const FINAL = ":final";
export const finalKey = (name: string) => volumesKey(name) + FINAL;
const FINAL_RESAVE_MS = 24 * 60 * 60 * 1000;
const finalSaved = new Map<string, { sign: string; at: number }>();
function saveFinalList(name: string, volumes: CatalogBook[]) {
  if (!volumes.length) return;
  const key = finalKey(name);
  const sign = volumes
    .map((v) => `${v.volume}:${v.isbn13.trim()}:${v.published ?? ""}`)
    .join("|");
  const was = finalSaved.get(key);
  if (was?.sign === sign && Date.now() - was.at < FINAL_RESAVE_MS) return;
  finalSaved.set(key, { sign, at: Date.now() });
  if (finalSaved.size > 5000)
    finalSaved.delete(finalSaved.keys().next().value!);
  priceQueries
    .saveSeriesVolumes(key, volumes)
    .then(forgetKnownVolumes)
    .catch(() => finalSaved.delete(key));
}

type VolumeList = Awaited<ReturnType<typeof seriesVolumes>>;
type NumberedBook = CatalogBook & { volume: number };

// every catalog asked about a series, side by side: the name as given, its
// other names, its Japanese name, and Google Books
async function askEveryCatalog(name: string) {
  const infoLookup = getSeriesInfo(name);
  // the other names only need AniList's answer, so they're searched while
  // the main name's catalog search is still running
  const otherNamesLookup = infoLookup.then((info) => {
    const lookups = otherNamesFor(name, info).map((other) =>
      seriesVolumes(other),
    );
    // its Japanese name too, when it has one in Japanese script (MONSTER's
    // or PLUTO's would only find unrelated books). Manga only: a novel's
    // Japanese name is its manga's too
    const japaneseName = info?.nativeName;
    const searchJapanese =
      japaneseName && JAPANESE_SCRIPT.test(japaneseName) && !isNovelName(name);
    if (searchJapanese)
      lookups.push(seriesVolumes(name, { searchAs: japaneseName }));
    return Promise.all(lookups);
  });
  // Google Books, once, under AniList's official English name (it knows
  // Frieren by its full one): new and upcoming volumes Open Library lacks
  const googleLookup = infoLookup.then((info) =>
    seriesVolumes(info?.name || name, { google: true }),
  );
  const [info, main, underOtherNames, fromGoogle] = await Promise.all([
    infoLookup,
    seriesVolumes(name),
    otherNamesLookup,
    googleLookup,
  ]);
  return { info, main, underOtherNames, fromGoogle };
}

// the catalogs' answers as one list, one book for each volume number.
// The link's name may be short ("Frieren") while the volumes carry the full
// English name ("Frieren: Beyond Journey's End"), and a series can be sold
// under other names (Detective Conan is mostly catalogued as Case Closed).
// So volumes found under the other names are merged in by volume number,
// with the same rules as within one search (addVolume), Google's last
async function mergeIntoOneList(
  name: string,
  info: SeriesInfo | null,
  main: VolumeList,
  others: VolumeList[],
): Promise<NumberedBook[]> {
  const byNumber = new Map<number | null, CatalogBook>(
    main.volumes.map((v) => [v.volume, v]),
  );
  const datedElsewhere = new Map<number | null, string>();
  const everyVolume = [main, ...others].flatMap((list) => list.volumes);
  const books = bookIsbns(everyVolume);

  // a 3-in-1 omnibus numbered like a volume isn't one, from any list (a
  // light novel may run long)
  const isOneVolume = (v: CatalogBook) =>
    isNovelName(name) || !isOmnibusLength(v);
  for (const [number, v] of byNumber)
    if (!isOneVolume(v)) byNumber.delete(number);
  for (const list of others) {
    for (const v of list.volumes)
      if (isOneVolume(v)) addVolume(byNumber, v, books, datedElsewhere);
  }

  // still a gap, or only a library rebind: those volumes asked for one by one
  // (saved a week, a few a series, under a daily cap)
  if (!books.size) {
    const found = await gapVolumes(info?.name || name, byNumber);
    for (const v of found) addVolume(byNumber, v, books, datedElsewhere);
  }
  adoptUpcomingDates(byNumber, datedElsewhere);

  // numbered ones only: pages list and page through volumes by number, so a
  // numberless book (the catalog's search can return one) has no place there
  return [...byNumber.values()]
    .filter((v): v is NumberedBook => v.volume != null)
    .sort((a, b) => a.volume - b.volume);
}

// a finished manga has as many volumes as AniList counts: a "vol. 35" past
// Attack on Titan's 34 is an art book or a box set a catalog numbered on (it
// was listed at $249.99). Only a stray one or two are dropped: a longer run
// past the count means the English edition is numbered its own way (or
// AniList is behind), and stays. Books holding several volumes keep their
// own numbering, and a novel's English count can differ
function withoutStraysPastTheEnd(
  numbered: NumberedBook[],
  info: SeriesInfo | null,
  name: string,
) {
  const isFinishedManga = info?.status === "FINISHED" && !isNovelName(name);
  const lastVolume = isFinishedManga && info.volumes ? info.volumes : null;
  if (lastVolume === null) return numbered;
  const pastTheEnd = numbered.filter((v) => !v.inBook && v.volume > lastVolume);
  const areStrays = pastTheEnd.length >= 1 && pastTheEnd.length <= 2;
  return areStrays ? numbered.filter((v) => !pastTheEnd.includes(v)) : numbered;
}

const BOX_SETS_SHOWN = 4;
// a seller on a big store ("eBay - pele-onfyah") counts as the store
const storeOfSeller = (store: string) => store.split(/\s[-–—|]\s/)[0]!.trim();

type CollectionOffer = Awaited<
  ReturnType<typeof priceQueries.getCollectionOffers>
>[number];

// a series' box sets and omnibuses, cheapest first, each with our affiliate
// tag where we have one. The same set at the same price from the same store,
// listed more than once (eBay sellers often post several), shows as one row
function boxSetRows(offers: CollectionOffer[]) {
  const cheapestFirst = [...offers].sort((a, b) => a.priceCents - b.priceCents);
  const seen = new Set<string>();
  const oneOfEach = cheapestFirst.filter((offer) => {
    const key = [
      storeOfSeller(offer.store).toLowerCase(),
      offer.format,
      offer.condition,
      offer.priceCents,
    ].join("|");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return oneOfEach.slice(0, BOX_SETS_SHOWN).map((offer) => {
    const url = affiliateOfferUrl(offer, offer.isbn13.trim());
    return {
      store: storeName(storeOfSeller(offer.store)),
      priceCents: offer.priceCents,
      format: offer.format,
      condition: offer.condition,
      url,
      affiliate: isAffiliateUrl(url),
    };
  });
}

// a series' page: its details, its volumes with the prices we know, and its
// box sets. Asks the catalogs (askEveryCatalog), merges their answers into
// one list (mergeIntoOneList), saves that list for the rest of the site, then
// adds stored prices
export async function getSeriesWithVolumes(name: string) {
  const { info, main, underOtherNames, fromGoogle } =
    await askEveryCatalog(name);
  const numbered = await mergeIntoOneList(name, info, main, [
    ...underOtherNames,
    fromGoogle,
  ]);
  const volumes = withoutStraysPastTheEnd(numbered, info, name);

  // start finding every cover now, in one batch, so they're ready by the
  // time the browser asks for them (failures are retried when it asks)
  volumes.forEach((v) => editionCoverId(v.isbn13).catch(() => {}));

  // the main name's problems always count. An other name's only count when
  // they left the page nearly empty: a slow obscure alias shouldn't flag a
  // series that already has its volumes
  const anOtherNameFailed = underOtherNames.some((list) => list.incomplete);
  const incomplete =
    main.incomplete || (anOtherNameFailed && volumes.length < 3);
  // the list every other part of the site reads (finalKey): saved whenever
  // it's whole and has changed
  if (!incomplete) saveFinalList(name, volumes);

  const isbns = volumes.map((v) => v.isbn13);
  const [known, recorded, pricedSets, scanned] = await Promise.all([
    priceQueries.getKnownPrices(isbns),
    // what each has usually sold for new: for estimates, when no store has
    // it today (never goes stale: every price ever recorded counts)
    priceQueries
      .getRecordedMedians(isbns)
      .catch(() => new Map<string, { new: number | null }>()),
    // box sets and omnibuses found while pricing its volumes
    priceQueries.getCollectionOffers(isbns).catch(() => []),
    // and the sets a scan by the series' name found (boxSetScan.ts)
    savedBoxSets(name).catch(() => null),
  ]);
  // a scanned set has no book of its own: it borrows the first volume's ISBN
  const scannedSets = (scanned?.sets ?? []).map((set) => ({
    ...set,
    isbn13: volumes[0]?.isbn13 ?? "",
  }));

  return {
    name,
    slug: slugify(name),
    info,
    incomplete,
    boxSets: boxSetRows([...pricedSets, ...scannedSets]),
    boxSetLinks: boxSetLinks(info?.name ?? name),
    volumes: volumes.map((v) => ({
      isbn13: v.isbn13,
      title: v.title,
      volume: v.volume,
      coverUrl: v.coverUrl,
      knownPriceCents: known.get(v.isbn13)?.priceCents ?? null,
      recordedCents: recorded.get(v.isbn13)?.new ?? null,
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
