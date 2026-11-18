// The saved volume lists of every series, and finding a series on someone's
// shelf. Reads only what's stored. Part of the price service (service.ts
// lists the parts).
import priceQueries from "../models/priceQueries.js";
import { knownSeriesName } from "./sources/anilist.js";
import { seriesName, slugify } from "./stores/match.js";
import { VOLUMES_KEY_VERSION } from "./volumesKey.js";
import { withoutEdition } from "../util/shelf/editionNames.js";
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

// the manga on someone's shelf that is this series, if any. Names are
// compared by slug, so "SPY x FAMILY" on a shelf finds "Spy x Family"
export async function findOnShelf<T extends { name: string }>(
  manga: T[],
  series: string,
): Promise<T | null> {
  // an edition is its series: "Vagabond VIZBIG Edition" finds "Vagabond" on
  // the shelf, and the other way round (util/shelf/editionNames.ts)
  const plain = withoutEdition(seriesName(series));
  const wanted = new Set([
    slugify(series),
    slugify(seriesName(series)),
    slugify(plain),
  ]);
  wanted.add(slugify(await knownSeriesName(plain).catch(() => plain)));
  return (
    manga.find(
      (m) =>
        wanted.has(slugify(m.name)) ||
        wanted.has(slugify(seriesName(m.name))) ||
        wanted.has(slugify(withoutEdition(seriesName(m.name)))),
    ) ?? null
  );
}
