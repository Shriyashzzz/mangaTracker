// Visitors first: how fast visitors are using a metered API, and whether a
// background job may spend a call of it. The nightly sweep (sweep.ts) and
// the background series lists (prices/seriesFiller.ts) both ask here, so the
// rule is written once.
import { callsSince, gbooksToday, type MeteredApi } from "../prices/callLog.js";

// what visitors will likely use before the reset: their pace over the last
// hour, or four times the last 15 minutes when that's higher (a rush)
export const usersWillNeed = (
  lastHour: number,
  last15: number,
  hoursLeft: number,
) => Math.max(lastHour, last15 * 4) * hoursLeft;

// a job stands aside when visitors would need more than is kept for them
export const shouldBackOff = (willNeed: number, keptLeft: number) =>
  willNeed > keptLeft;

const pacific = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Los_Angeles",
  hour: "numeric",
  minute: "numeric",
  hourCycle: "h23",
});
export const pacificClock = (now: number) => {
  const parts = pacific.formatToParts(new Date(now));
  const part = (type: string) =>
    Number(parts.find((p) => p.type === type)?.value ?? 0);
  return { hour: part("hour"), minute: part("minute") };
};

// how long until the Pacific midnight reset (at least a few minutes, so a
// rate times it never reads as nothing). eBay, Books-A-Million and Google
// Books all count Pacific days
export const hoursUntilReset = (now: number) => {
  const { hour, minute } = pacificClock(now);
  return Math.max(0.1, 24 - hour - minute / 60);
};

// visitors' pace on one API: the last hour, and the last 15 minutes
export async function usersPace(api: MeteredApi, now: number) {
  const [lastHour, last15] = await Promise.all([
    callsSince(api, "user", now - 60 * 60_000, now),
    callsSince(api, "user", now - 15 * 60_000, now),
  ]);
  return { lastHour, last15 };
}

// Google Books: about 1,000 calls a day for the whole site, and this many
// always kept for visitors
export const GBOOKS = { daily: 1000, kept: 300 };

// what's spare of a day's calls for the background: what's left, less what
// is kept for visitors or what their pace says they'll use before the
// reset, whichever is more
export const spareCalls = (left: number, kept: number, willNeed: number) =>
  left - Math.max(kept, willNeed);

// whether the background may build or refresh a series' list now: a list
// can take 2 Google Books calls, so 2 have to be spare
export async function gbooksRoom(now: number) {
  const left = GBOOKS.daily - (await gbooksToday());
  const pace = await usersPace("gbooks", now);
  const willNeed = usersWillNeed(
    pace.lastHour,
    pace.last15,
    hoursUntilReset(now),
  );
  return spareCalls(left, GBOOKS.kept, willNeed) >= 2;
}
