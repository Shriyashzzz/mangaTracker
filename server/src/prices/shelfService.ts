// Prices for someone's shelf: the saved volume lists of every series, and
// the cheapest known price for each manga. Reads only what's stored. Part of
// the price service (service.ts lists the parts).
import { titleVolume } from "./volumeNames.js";
import priceQueries from "../models/priceQueries.js";
import { knownSeriesName, knownSeriesNames } from "./sources/anilist.js";
import { seriesName, slugify } from "./stores/match.js";
import { VOLUMES_KEY_VERSION } from "./volumesKey.js";
import {
  FINAL,
  knownVolumes,
  seriesVolumesCache,
  type KnownVolume,
} from "./seriesCache.js";

export { forgetKnownVolumes, type KnownVolume } from "./seriesCache.js";

// ---------- the shelf ----------

// how long the grouped volumes (seriesCache.ts knownVolumes) are kept before
// they're built again
const KNOWN_VOLUMES_MS = 10 * 60 * 1000;

export async function knownVolumesBySeries() {
  if (Date.now() - knownVolumes.at < KNOWN_VOLUMES_MS) {
    return knownVolumes.bySeries;
  }
  const bySeries = new Map<string, Map<string, KnownVolume>>();
  const omnibuses = await priceQueries
    .getOmnibusIsbns()
    .catch(() => new Set<string>());
  const put = (key: string, v: KnownVolume) => {
    if (!bySeries.has(key)) bySeries.set(key, new Map());
    bySeries.get(key)!.set(v.isbn13, v);
  };
  // a series whose final list is saved is exactly that list (finalKey):
  // under the series' own name and the name each title carries ("Case
  // Closed, Vol. 3" in Detective Conan's)
  const settled = new Set<string>();
  for (const { key, ...v } of await priceQueries
    .getFinalVolumeTitles()
    .catch(() => [])) {
    const own = slugify(key.slice(VOLUMES_KEY_VERSION.length, -FINAL.length));
    for (const slug of new Set([own, slugify(seriesName(v.title))])) {
      settled.add(slug);
      put(slug, v);
    }
  }
  const add = (v: KnownVolume) => {
    // a 3-in-1 omnibus numbered like a volume isn't that volume
    if (omnibuses.has(v.isbn13.trim())) return;
    const key = slugify(seriesName(v.title));
    // the other lists' editions of a settled series aren't its volumes
    if (settled.has(key)) return;
    put(key, v);
  };
  (await priceQueries.getBookTitles()).forEach(add);
  // every saved list, so a series built before a restart still has its volumes
  (await priceQueries.getSavedVolumeTitles().catch(() => [])).forEach(add);
  // full volume lists from series pages people opened recently
  for (const hit of seriesVolumesCache.values()) hit.volumes.forEach(add);
  knownVolumes.at = Date.now();
  knownVolumes.bySeries = bySeries;
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
