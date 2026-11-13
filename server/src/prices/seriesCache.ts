// What the price service's files remember between requests about series'
// lists of volumes. Kept in one small file so the files that fill it
// (seriesService.ts) and read it (shelfService.ts) don't import each other.
import type { CatalogBook } from "./types.js";
import { volumesKey } from "./volumesKey.js";

// each catalog lookup's answer, by the key it's saved under
export const seriesVolumesCache = new Map<
  string,
  { at: number; volumes: CatalogBook[] }
>();

// the series page's careful list is saved under the series' key and this
// ending; the rest of the site reads that one list
export const FINAL = ":final";
export const finalKey = (name: string) => volumesKey(name) + FINAL;

// a volume as the saved lists know it. `published`: its release date, when a
// list knows it
export type KnownVolume = {
  isbn13: string;
  title: string;
  published?: string | null;
};

// the volumes we know for each series, grouped by the series' slug. Rebuilt
// every few minutes (shelfService.ts knownVolumesBySeries); shared by
// everyone's shelf. `at`: when it was last built, 0 for "build it again"
export const knownVolumes = {
  at: 0,
  bySeries: new Map<string, Map<string, KnownVolume>>(),
};

// a series' list was just built or saved: counted on the next ask, not in
// ten minutes
export const forgetKnownVolumes = () => {
  knownVolumes.at = 0;
};
