// What the shared shelf's pieces share: a series' reading status, the volumes
// it owns, and those written as ranges
import type { SharedShelf } from "../../lib/account";
import { ownedCount, ownedOf } from "../../lib/ownedVolumes";

export type SharedManga = SharedShelf["manga"][number];

export const statusOf = (m: SharedManga) =>
  m.status ? "Finished" : m.planned ? "To read" : "Reading";

// each status has its own colour of stamp ink, carried through its section
// tape, its rows and the spines in its sheet (--tone)
export const TONES = {
  Reading: "var(--stamp-market)",
  Finished: "var(--stamp-new)",
  "To read": "var(--stamp-ebook)",
} as const;
export const toneOf = (m: SharedManga) =>
  ({ "--tone": TONES[statusOf(m)] }) as React.CSSProperties;

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

// every whole volume from 1 to the furthest they own, and any half volume
// they own ("10.5"): theirs stand, the rest are gaps
export function shelfOf(owned: number[]) {
  const highest = Math.max(0, ...owned);
  const all = new Set(owned);
  for (let v = 1; v <= Math.floor(highest); v++) all.add(v);
  const mine = new Set(owned);
  return [...all].sort((a, b) => a - b).map((v) => ({ v, mine: mine.has(v) }));
}
