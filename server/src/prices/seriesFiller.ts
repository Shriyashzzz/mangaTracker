// Background volume lists: a series' volumes are only looked up when someone
// opens its page, so a series search engines reach first had none to show
// (226 of 386 on 2026-11-11). This builds the missing ones, one series every
// few minutes, most popular first, the same way a visit does (getSeries:
// Open Library, Google Books and AniList, all free). Once built it counts
// as known: the series page, /series and the sitemap list it.
//
// Runs where the price filler runs (collector/filler.ts: production, or
// PRICE_FILL=on; PRICE_FILL=off stops both)
import { listKnownSeries } from "./sources/anilist.js";
import {
  forgetKnownVolumes,
  getSeries,
  knownVolumesBySeries,
} from "./service.js";
import { fillerOn } from "../collector/filler.js";
import { slugify } from "./stores/match.js";

// every 6 minutes: each build asks Google Books once, and its ~1,000 calls a
// day are shared with visitors and cover lookups
const EVERY_MS = 6 * 60_000;
// one that found nothing waits this long before it's tried again
const RETRY_MS = 7 * 24 * 60 * 60_000;

const tried = new Map<string, number>();

// the series with no volumes known, most popular first; ones tried lately
// wait their turn
export async function nextSeries(now = Date.now()): Promise<string | null> {
  const [series, bySeries] = await Promise.all([
    listKnownSeries(),
    knownVolumesBySeries(),
  ]);
  const missing = series
    .filter((s) => !bySeries.get(slugify(s.name))?.size)
    .filter((s) => now - (tried.get(s.name) ?? -Infinity) >= RETRY_MS)
    .sort(
      (a, b) =>
        (a.popularityRank ?? Infinity) - (b.popularityRank ?? Infinity) ||
        (b.score ?? 0) - (a.score ?? 0),
    );
  return missing[0]?.name ?? null;
}

export async function fillSeries(now = Date.now()) {
  const name = await nextSeries(now);
  if (!name) return null;
  tried.set(name, now);
  const series = await getSeries(name);
  forgetKnownVolumes();
  return { name, volumes: series?.volumes.length ?? 0 };
}

export const resetSeriesFiller = () => tried.clear();

let timer: ReturnType<typeof setInterval> | null = null;

// started by server.ts, never by the tests
export function startSeriesFiller() {
  if (timer || !fillerOn()) return;
  const run = () =>
    fillSeries().catch((e: Error) =>
      console.error("Background series lists failed:", e.message),
    );
  setTimeout(run, 90_000).unref();
  timer = setInterval(run, EVERY_MS);
  timer.unref();
  console.log("Background series lists on: one every 6 minutes");
}
