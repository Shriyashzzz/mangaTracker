// The Volumes tab's To get list (pages/Home/FinishList.tsx): a series' missing
// volumes or books in the order to get them. Pure, so the server's Jest
// tests it
import type { MissingVolume } from "./collector";

// this many gaps in a row are one line ("Vols. 6–59")
const LONG_GAP = 6;

// one line of the list: a volume or book, or a long run of gaps
export type Line =
  | { kind: "one"; volume: MissingVolume }
  | { kind: "run"; volumes: MissingVolume[] };

// the missing, in the order to get them: what comes after the furthest
// they own, then the gaps before it (or the gaps first, if they chose that).
// Long runs of gaps are folded into one line
export function toGetLines(
  missing: MissingVolume[],
  owned: number[],
  gapsFirst: boolean,
): Line[] {
  const furthest = Math.max(0, ...owned);
  const last = (m: MissingVolume) => Math.max(...(m.inside ?? [m.volume]));
  const gaps = missing.filter((m) => last(m) < furthest);
  const after = missing.filter((m) => last(m) >= furthest);
  // gaps in runs: a run is volumes one after another
  const runs: MissingVolume[][] = [];
  for (const m of gaps) {
    const run = runs[runs.length - 1];
    const prev = run?.[run.length - 1];
    if (
      run &&
      prev &&
      !m.inside &&
      !prev.inside &&
      m.volume === prev.volume + 1
    )
      run.push(m);
    else runs.push([m]);
  }
  const gapLines: Line[] = runs.flatMap((run): Line[] =>
    run.length >= LONG_GAP
      ? [{ kind: "run", volumes: run }]
      : run.map((volume) => ({ kind: "one", volume })),
  );
  const afterLines: Line[] = after.map((volume) => ({ kind: "one", volume }));
  return gapsFirst
    ? [...gapLines, ...afterLines]
    : [...afterLines, ...gapLines];
}
