// Which volumes someone owns. Most own a run from the first ("up to vol. 14"),
// which is all `volumesOwned` says; with gaps (One Piece 1 and 4) `ownedList`
// has them exactly and `volumesOwned` is its highest. An empty list means 1 to
// `volumesOwned`. Kept in step with server/src/util/shelf/ownedList.ts
import type { Manga } from "./types";

const MAX_VOLUME = 999;

type Owned = Pick<Manga, "volumesOwned"> & { ownedList?: number[] };

// the same rule as the server's: a run from 1 is just its number
export function ownedVolumes(
  volumesOwned: number | null | undefined,
  list: number[] | null | undefined,
): { volumesOwned: number | null; ownedList: number[] } {
  const sorted = [
    ...new Set(
      (list ?? [])
        .filter((v) => Number.isFinite(v) && v >= 0 && v <= MAX_VOLUME)
        .map((v) => Math.round(v * 10) / 10),
    ),
  ].sort((a, b) => a - b);
  if (!sorted.length)
    return { volumesOwned: volumesOwned || null, ownedList: [] };
  const highest = sorted[sorted.length - 1]!;
  const isRun = sorted.every((v, i) => v === i + 1);
  return {
    volumesOwned: Math.floor(highest) || null,
    ownedList: isRun ? [] : sorted,
  };
}

// every volume they own, in order
export const ownedOf = (m: Owned): number[] =>
  m.ownedList?.length
    ? m.ownedList
    : Array.from({ length: m.volumesOwned ?? 0 }, (_, i) => i + 1);

export const owns = (m: Owned, volume: number) =>
  m.ownedList?.length
    ? m.ownedList.includes(volume)
    : volume >= 1 &&
      volume <= (m.volumesOwned ?? 0) &&
      Number.isInteger(volume);

// what they own once this volume is added
export const withVolume = (m: Owned, volume: number) =>
  ownedVolumes(null, [...ownedOf(m), volume]);

// [1, 2, 3, 5, 7, 8] -> "1–3, 5, 7–8"
export function rangesText(volumes: number[]): string {
  const parts: string[] = [];
  let i = 0;
  while (i < volumes.length) {
    let j = i;
    while (
      j + 1 < volumes.length &&
      Number.isInteger(volumes[j]) &&
      volumes[j + 1] === volumes[j]! + 1
    )
      j++;
    parts.push(j > i ? `${volumes[i]}–${volumes[j]}` : String(volumes[i]));
    i = j + 1;
  }
  return parts.join(", ");
}

// "1-5, 8, 10.5" -> [1, 2, 3, 4, 5, 8, 10.5]; null if any part isn't a
// volume or a range of them. Blank is no volumes
export function parseVolumes(text: string): number[] | null {
  const out: number[] = [];
  // "1 - 5" is one range
  const tidy = text.replace(/\s*[-–]\s*/g, "-");
  for (const raw of tidy.split(/[,\s]+/).filter(Boolean)) {
    const range = /^(\d{1,3})\s*[-–]\s*(\d{1,3})$/.exec(raw);
    if (range) {
      const [from, to] = [Number(range[1]), Number(range[2])];
      if (from < 0 || to > MAX_VOLUME || from > to) return null;
      for (let v = from; v <= to; v++) out.push(v);
      continue;
    }
    const one = /^\d{1,3}(\.\d)?$/.exec(raw);
    if (!one) return null;
    out.push(Number(raw));
  }
  return [...new Set(out)].sort((a, b) => a - b);
}

// how a card or the details page says it: "up to vol. 14", or "vols. 1, 4"
// (long lists cut short: "vols. 1–14, 16, 20–22…")
export function ownedPhrase(m: Owned, longest = 24): string | null {
  if (!m.ownedList?.length)
    return m.volumesOwned ? `up to vol. ${m.volumesOwned}` : null;
  const text = rangesText(m.ownedList);
  const comma = text.lastIndexOf(",", longest);
  const cut =
    text.length <= longest
      ? text
      : `${comma > 0 ? text.slice(0, comma) : text.slice(0, longest)}…`;
  return `${m.ownedList.length === 1 ? "vol." : "vols."} ${cut}`;
}
