// whole volumes in a row, together: [7, 8, 9, 12] is [7, 8, 9] and [12]
export function runsOf(volumes: number[]) {
  const runs: number[][] = [];
  for (const v of [...volumes].sort((a, b) => a - b)) {
    const last = runs.at(-1);
    if (last && v === last.at(-1)! + 1) last.push(v);
    else runs.push([v]);
  }
  return runs;
}

// [1, 2, 3, 5] -> "1–3, 5"
export const runsText = (volumes: number[]) =>
  runsOf(volumes)
    .map((run) => (run.length === 1 ? `${run[0]}` : `${run[0]}–${run.at(-1)}`))
    .join(", ");
