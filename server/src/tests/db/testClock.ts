// Times for tests, worked out from the real clock. A test whose rows the
// database stamps with the real time can't use a fixed date: once the real
// day moves past it, its day (the sweep's counters are kept by Pacific day)
// no longer matches, and the test fails though nothing changed.
import { ebayDay } from "../../prices/providers/ebay.js";

const pacific = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Los_Angeles",
  hour: "numeric",
  minute: "numeric",
  hourCycle: "h23",
});

// today, Pacific time, at this hour and minute: 10:30pm is
// todayInPacificAt(22, 30). Past or still to come, it's on today's Pacific
// date, the day the database's own rows fall on
export function todayInPacificAt(hour: number, minute = 0, now = Date.now()) {
  const wanted = hour * 60 + minute;
  const thisMinute = now - (now % 60_000);
  const guess = thisMinute + (wanted - minutesOf(now)) * 60_000;
  // a daylight-saving change in between moves the clock an hour: put right
  return guess + (wanted - minutesOf(guess)) * 60_000;
}

// the Pacific clock's minutes since midnight at that moment
function minutesOf(at: number) {
  const parts = pacific.formatToParts(new Date(at));
  const part = (type: string) =>
    Number(parts.find((p) => p.type === type)?.value ?? 0);
  return part("hour") * 60 + part("minute");
}

// that time's Pacific date ("2026-11-15") and its month ("2026-11-01"), as
// the usage counters key them
export const pacificDayOf = (at: number) => ebayDay(new Date(at));
export const monthOf = (day: string) => `${day.slice(0, 7)}-01`;
