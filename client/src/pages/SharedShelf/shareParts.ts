// What the shared shelf's pieces share: a series' reading status, the volumes
// it owns, and those written as ranges
import type { SharedShelf } from "../../lib/account";
import { ownedCount, ownedOf } from "../../lib/ownedVolumes";

export type SharedManga = SharedShelf["manga"][number];

export const statusOf = (m: SharedManga) =>
  m.status ? "Finished" : m.planned ? "To read" : "Reading";

// a shelf from before owned volumes were shared sends none
const owned = (m: SharedManga) => ({
  volumesOwned: m.volumesOwned ?? null,
  ownedList: m.ownedList,
});
export const ownedVolumesOf = (m: SharedManga) => ownedOf(owned(m));
export const ownedCountOf = (m: SharedManga) => ownedCount(owned(m));

// 1, 2, 3, 5, 7, 8 -> "1–3, 5, 7–8"
export function volumeRanges(volumes: number[]) {
  const runs: [number, number][] = [];
  for (const v of volumes) {
    const last = runs.at(-1);
    if (last && Number.isInteger(v) && v === last[1] + 1) last[1] = v;
    else runs.push([v, v]);
  }
  return runs.map(([a, b]) => (a === b ? `${a}` : `${a}–${b}`)).join(", ");
}
