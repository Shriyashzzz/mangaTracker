// The order a shelf's release checks go in, and which lane each waits in on
// the server (server/src/util/releases/laneQueue.ts). First the series most
// likely to have news someone is waiting for: ones they're caught up on (by
// the latest chapter the last check found), then 5 stars, then 4. Those go in
// the "now" lane. The rest wait in "later", for when the server is free:
// series they're reading, those with a chapter known first; then their to-read
// list; then what they've finished reading. Newest additions first within each.
import type { Manga } from "./types";

// as the New tab counts it: within this many chapters of the latest
export const CAUGHT_UP_WITHIN = 3;

type Ranked = Pick<
  Manga,
  "id" | "bookmark" | "latestChapter" | "rating" | "planned" | "status"
>;

export const isCaughtUp = (m: Ranked) =>
  m.latestChapter != null &&
  m.bookmark != null &&
  m.latestChapter - m.bookmark <= CAUGHT_UP_WITHIN;

// lower goes first
const rankOf = (m: Ranked): [number, number] => {
  if (isCaughtUp(m)) return [0, 0];
  if (m.rating === 5) return [1, 0];
  if (m.rating === 4) return [2, 0];
  if (m.planned) return [3, 2];
  if (m.status) return [3, 3];
  return [3, m.latestChapter != null ? 0 : 1];
};

export const laneOf = (m: Ranked): "now" | "later" =>
  rankOf(m)[0] <= 2 ? "now" : "later";

export function checkOrder<T extends Ranked>(manga: T[]): T[] {
  return [...manga].sort((a, b) => {
    const [ga, sa] = rankOf(a);
    const [gb, sb] = rankOf(b);
    // ids count up as series are added, so the newest is the highest
    return ga - gb || sa - sb || b.id - a.id;
  });
}
