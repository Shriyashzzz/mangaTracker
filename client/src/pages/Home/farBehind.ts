// What the Chapters side says to a reader who owns no volumes when every
// series is further back than the list waits for (NewTabParts FarBehind):
// where they are, in words. Pure, so the server's tests can load it.

export type FarBehindSeries = {
  name: string;
  // the chapter they're on
  on: number;
  // the newest out, when known
  latest: number | null;
};

// the most series named one by one under the title
export const FAR_BEHIND_NAMED = 3;

const count = (n: number) => n.toLocaleString("en-US");

// where one series stands: "ch. 38 of 232", or just "ch. 38"
export const standing = ({ on, latest }: FarBehindSeries) =>
  latest != null ? `ch. ${count(on)} of ${count(latest)}` : `ch. ${count(on)}`;

// "You're on ch. 38 of 232.", or "You're further back on 3 series."
export const farBehindTitle = (series: FarBehindSeries[]) =>
  series.length === 1
    ? `You're on ${standing(series[0]!)}.`
    : `You're further back on ${series.length} series.`;
