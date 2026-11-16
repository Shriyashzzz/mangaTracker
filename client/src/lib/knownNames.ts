// the series names the site already knows that a typo is a slip or two
// from, closest first (server prices/seriesNames.ts): the last try for a
// word AniList can't match at all ("chainsw man"). Given to withNearMatches
// (lib/nearMatches.ts) by every series search. None when it can't be asked
import { getJson } from "./api";

export const knownNamesNear = (query: string, signal?: AbortSignal) =>
  getJson<{ names: string[] }>(
    `/api/prices/series-near?${new URLSearchParams({ q: query })}`,
    signal,
  )
    .then((found) => found.names)
    .catch(() => [] as string[]);
