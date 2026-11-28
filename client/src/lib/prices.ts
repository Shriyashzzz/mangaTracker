// The price checker's API calls, plus the small formatting and URL helpers
// its pages share.
import { inCanada } from "./country";
import { humanQuery } from "./turnstile";
import { isbnFromTyped } from "./barcode";
import type { SyntheticEvent } from "react";
import { API_URL, getJson } from "./api";
import { withNearMatches } from "./nearMatches";
import { knownNamesNear } from "./knownNames";
import type {
  CatalogBook,
  Highlights,
  DealCard,
  Series,
  SeriesHit,
  SeriesIndexEntry,
  VolumePrices,
} from "./types";

// ---------- API ----------

export const searchVolumes = (q: string, signal?: AbortSignal) =>
  getJson<{ results: CatalogBook[] }>(
    `/api/prices/search?${new URLSearchParams({ q })}`,
    signal,
  ).then((d) => d.results);

// storedOnly: what's already saved, without spending a refresh, for someone
// looking at Canadian prices instead
// a live check (paid searches) carries a Turnstile token (lib/turnstile.ts);
// stored prices don't need one
// `human`: the person check already asked for (useVolumeLoad starts it with
// the stored prices, so the live check needn't wait for it after)
export const getVolume = async (
  isbn: string,
  signal?: AbortSignal,
  storedOnly = false,
  human?: Promise<string>,
) =>
  getJson<VolumePrices>(
    `/api/prices/${encodeURIComponent(isbn)}${storedOnly ? "?stored=1" : await (human ?? humanQuery("?", signal))}`,
    signal,
  );

// `popular`: the most read first (a typo's retry, lib/nearMatches.ts)
export const searchSeries = (
  q: string,
  signal?: AbortSignal,
  popular = false,
) =>
  getJson<{ results: SeriesHit[] }>(
    `/api/prices/series-search?${new URLSearchParams({ q, ...(popular ? { popular: "true" } : {}) })}`,
    signal,
  ).then((d) => d.results);

// a search someone typed: a typo gets its words' matches, as a guess
// ("Did you mean", lib/nearMatches.ts)
export const findSeries = (q: string, signal?: AbortSignal) =>
  withNearMatches(
    q,
    (text, retry) => searchSeries(text, signal, retry),
    (hit) => hit.name,
    (text) => knownNamesNear(text, signal),
  );

// `strict`: the name came only from the page's address, so it has to be one
// of the series' own names (made-up addresses aren't some real series)
export const getSeries = (name: string, signal?: AbortSignal, strict = false) =>
  getJson<Series>(
    `/api/prices/series?${new URLSearchParams({ name, ...(strict ? { strict: "true" } : {}) })}`,
    signal,
  );

// every series we know, for the /series page. The last answer is kept ten
// minutes (as long as the server keeps its own), so going Back to the list
// draws it at once, at its full height: the browser puts the scroll back
// before a fresh answer could arrive, and a short "loading" page left them
// somewhere else
const SERIES_INDEX_FRESH_MS = 10 * 60_000;
let seriesIndex: { at: number; series: SeriesIndexEntry[] } | null = null;

// the kept list, or null when there's none or it's old
export const keptSeriesIndex = () =>
  seriesIndex && Date.now() - seriesIndex.at < SERIES_INDEX_FRESH_MS
    ? seriesIndex.series
    : null;

export async function getSeriesIndex(signal?: AbortSignal) {
  const kept = keptSeriesIndex();
  if (kept) return kept;
  const series = await getJson<SeriesIndexEntry[]>(
    "/api/prices/series-index",
    signal,
  );
  seriesIndex = { at: Date.now(), series };
  return series;
}

export const getHighlights = (signal?: AbortSignal) =>
  getJson<Highlights>("/api/prices/highlights", signal);

// how many volumes have a price checked in the last 30 days, US or Canada
// (the About page). Worked out hourly on the server
export const getPricedCount = (signal?: AbortSignal) =>
  getJson<{ pricedVolumes: number }>("/api/prices/stats", signal).then(
    (r) => r.pricedVolumes,
  );

// the /deals page: volumes now well under their usual price
export const getDeals = (signal?: AbortSignal) =>
  getJson<{ deals: DealCard[] }>("/api/prices/deals", signal);

// which deals are of series on the signed-in reader's shelf, by ISBN
export const getDealsOnShelf = (signal?: AbortSignal) =>
  getJson<{ isbns: string[] }>("/api/prices/deals/shelf", signal).then(
    (r) => r.isbns,
  );

// ---------- addresses ----------

// a typed or pasted ISBN (13 or 10 characters, dashes and spaces allowed),
// checked and as its ISBN-13; the same reader the barcode scanner uses
export const asIsbn = isbnFromTyped;

// the price pages' addresses (lib/pricePaths.ts: no network code there, so
// pure code and the tests can use them)
export {
  slugify,
  seriesPath,
  seriesCanonicalPath,
  editionCanonicalPath,
  volumePath,
} from "./pricePaths";

// ---------- formatting ----------

const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});
// "CA$15.99": never mistaken for US dollars
const cad = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "CAD",
});
// A price the server sent for the country they shop in: "$9.99", or
// "CA$13.99" with Canada picked (the server sent Canadian prices then; see
// lib/country.ts)
export const formatCents = (cents: number) =>
  (inCanada() ? cad : usd).format(cents / 100);
// What they said they paid for their own books: their own number, in
// whatever dollars they paid in, so never relabelled as US or Canadian
export const formatPaid = (cents: number) => usd.format(cents / 100);
// A US price whatever they picked: the US volume page's own numbers and the
// tags search engines read, which are always the US ones
export const formatUsd = (cents: number) => usd.format(cents / 100);
export { wholeMoney } from "./country";

// A store's name as it's shown: a seller on a big store goes by the store's
// name ("eBay - secretariat0515" is "eBay"). A stranger's username says
// nothing to a reader and looks like a glitch; the link still goes to that
// seller's listing. The server's twin is shopName in
// server/src/prices/volumeNames.ts
export const shopName = (store: string) => store.split(/\s[-–—|]\s/)[0]!.trim();

const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
// a check older than this many days
export const olderThanDays = (date: string, days: number) =>
  Date.now() - Date.parse(date) > days * 86_400_000;

export function timeAgo(date: string | Date) {
  const minutes = Math.round((new Date(date).getTime() - Date.now()) / 60000);
  if (Math.abs(minutes) < 60) return rtf.format(minutes, "minute");
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return rtf.format(hours, "hour");
  return rtf.format(Math.round(hours / 24), "day");
}

// "Jujutsu Kaisen, Vol. 24 (Shonen Jump)" -> "Jujutsu Kaisen", for the shelf
export const seriesName = (title: string) =>
  title
    .replace(/\(.*?\)/g, " ")
    .replace(/,?\s*\bvol(?:ume)?\.?\s*\d+.*$/i, "")
    .replace(/\s+\d+\s*$/, "")
    .replace(/\s+/g, " ")
    .trim();

export const seriesTitle = seriesName;

// ---------- covers ----------

// edition covers come from our server's cover route (it finds the edition's
// cover once and redirects to it). Open Library's own URLs serve a blank 1x1
// image for missing covers unless asked for default=false, which makes them
// 404 instead, so onError can show our placeholder
export const coverSrc = (url?: string | null) => {
  if (!url) return undefined;
  if (url.startsWith("/api/")) return `${API_URL}${url}`;
  return url.startsWith("https://covers.openlibrary.org/") && !url.includes("?")
    ? `${url}?default=false`
    : url;
};

// a cover that fails on our cover route is usually Open Library asking us to
// slow down, so it's asked for again a couple of times, further apart each
// time, with the placeholder showing meanwhile
const COVER_RETRIES = 2;
const COVER_RETRY_MS = 6000;

// onError for cover <img>s: hides a cover that failed to load, revealing the
// placeholder behind it, and fades it in if a later try works
// a store's "No image available" picture loads fine, so onError never hears
// of it. Covers are tall; those placeholders are square or wide, so anything
// that isn't portrait is hidden and the drawn placeholder behind it shows
export const hidePlaceholderCover = (e: SyntheticEvent<HTMLImageElement>) => {
  const img = e.currentTarget;
  if (img.naturalWidth && img.naturalWidth >= img.naturalHeight * 0.95)
    img.hidden = true;
};

export const hideBrokenCover = (e: SyntheticEvent<HTMLImageElement>) => {
  const img = e.currentTarget;
  const tries = Number(img.dataset.tries ?? 0);
  // the address that failed: one of its sizes, when it was offered several
  const failed = img.currentSrc || img.src;
  // (only a volume's own cover is tried again: a series cover that fails
  // isn't Open Library being busy, and waiting left an empty frame)
  if (tries >= COVER_RETRIES || !/\/api\/prices\/cover\/\d{13}/.test(failed)) {
    img.hidden = true;
    return;
  }
  // kept in the layout (not hidden) so a lazy image still loads
  img.style.opacity = "0";
  img.dataset.tries = String(tries + 1);
  img.addEventListener("load", () => (img.style.opacity = ""), { once: true });
  setTimeout(
    () => {
      const url = new URL(failed);
      url.searchParams.set("try", String(tries + 1));
      // asked for again at the size that failed, and only that one
      img.removeAttribute("srcset");
      img.removeAttribute("sizes");
      img.src = url.href;
    },
    COVER_RETRY_MS * (tries + 1),
  );
};

// ---------- light novels ----------
// a light novel's prices are kept apart from the manga of the same name: the
// price checker calls the novel "Overlord Light Novel" and its volumes
// "Overlord Light Novel, Vol. 3" (server/src/prices/lightNovel.ts)
const NOVEL = /\s+light\s+novel(?=,|$)/i;

export const priceName = (manga: { name: string; lightNovel?: boolean }) =>
  manga.lightNovel && !NOVEL.test(manga.name)
    ? `${manga.name} Light Novel`
    : manga.name;

// for showing: "Overlord Light Novel, Vol. 3" is "Overlord, Vol. 3", a light
// novel; anything else is as it is
export const novelParts = (title: string) => ({
  title: title.replace(NOVEL, ""),
  lightNovel: NOVEL.test(title),
});

// ---------- where a series is from ----------
// What a comic is called where it's from, for a series' page: a Korean one
// is a manhwa, a Chinese or Taiwanese one a manhua. Null for Japan's (a
// manga, which nothing needs to say) and when the country isn't known
export const comicKind = (origin: string | null | undefined) =>
  origin === "KR"
    ? "Manhwa"
    : origin === "CN" || origin === "TW"
      ? "Manhua"
      : null;

// "12 volumes in Korea": the country its own volumes are counted in. Japan
// when it isn't known, as most of the catalog is
const PLACES: Record<string, string> = {
  JP: "Japan",
  KR: "Korea",
  CN: "China",
  TW: "Taiwan",
};
export const originPlace = (origin: string | null | undefined) =>
  PLACES[origin ?? ""] ?? "Japan";
