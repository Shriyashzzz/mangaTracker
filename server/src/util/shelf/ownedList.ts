// Which volumes someone owns. Most own a run from the first ("up to vol. 14"),
// and that's all `volumesOwned` says. Someone with gaps (One Piece 1 and 4)
// has the exact list in `ownedList` too, and `volumesOwned` is its highest, so
// everything that only knows "up to" (the New tab, prices, the finished-series
// skip) keeps working. An empty list means 1 to `volumesOwned`, as it always
// did. A list that is a run from 1 is stored as just its number, so there's
// one way to say each thing. Kept in step with client/src/lib/ownedVolumes.ts
const MAX_VOLUME = 999;

export function ownedVolumes(
  volumesOwned: number | null | undefined,
  list: number[] | null | undefined,
): { volumesOwned: number | null; ownedList: number[] } {
  const sorted = [
    ...new Set(
      (list ?? [])
        .filter((v) => Number.isFinite(v) && v >= 0 && v <= MAX_VOLUME)
        // "10.5" is a volume; nothing finer
        .map((v) => Math.round(v * 10) / 10),
    ),
  ].sort((a, b) => a - b);
  // no list: "up to" says it all
  if (!sorted.length) return { volumesOwned: volumesOwned || null, ownedList: [] };
  const highest = sorted[sorted.length - 1]!;
  const isRun = sorted.every((v, i) => v === i + 1);
  return {
    volumesOwned: Math.floor(highest) || null,
    ownedList: isRun ? [] : sorted,
  };
}
