// How a change made offline is put together with what the server has now,
// which another device may have changed in the meantime. Pure, so it can be
// tested on its own (offlineChanges.ts applies it).
//
//   owned volumes      sent as where they started and where they ended up,
//                      so what was added and taken away can be told apart:
//                      only those are applied. A volume ticked on the laptop
//                      meanwhile stays; one taken off there stays off
//   chapter, volume    sent with the number it was moved from. Nobody else
//   read               moved it since: theirs is saved, back or forward.
//                      Somebody did: the furthest of the two wins, as when
//                      two shelf entries are merged (mangaQueries merge)

const sortedOnce = (volumes: number[]) =>
  [...new Set(volumes)].sort((a, b) => a - b);

export function mergeOwned(
  now: number[],
  started: number[],
  ended: number[],
): number[] {
  const added = ended.filter((v) => !started.includes(v));
  const taken = new Set(started.filter((v) => !ended.includes(v)));
  return sortedOnce([...now.filter((v) => !taken.has(v)), ...added]);
}

export function mergePlace(
  now: number | null,
  from: number | null,
  to: number | null,
): number | null {
  if ((now ?? null) === (from ?? null)) return to;
  return Math.max(now ?? 0, to ?? 0);
}
