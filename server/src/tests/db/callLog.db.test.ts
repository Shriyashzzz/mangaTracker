// The call log (prices/callLog.ts) with a real database: visitors' calls and
// the background's are counted apart, five minutes at a time, and Google
// Books also gets a day's total. No API is called.
import {
  asBackground,
  callsSince,
  gbooksToday,
  noteCall,
} from "../../prices/callLog.js";
import { closeDb, emptyDb } from "./testDb.js";
import { pacificDayOf, todayInPacificAt } from "./testClock.js";

// 2:07pm Pacific today, from the real clock (testClock.ts): well inside one
// Pacific day, whatever the date
const NOW = todayInPacificAt(14, 7);
const MIN = 60_000;

beforeEach(emptyDb);
afterAll(closeDb);

test("visitors' calls and the background's are counted apart", async () => {
  await noteCall("ebay", 1, NOW);
  await noteCall("ebay", 2, NOW - 3 * MIN);
  await asBackground(() => noteCall("ebay", 5, NOW));
  expect(await callsSince("ebay", "user", NOW - 60 * MIN, NOW)).toBe(3);
  expect(await callsSince("ebay", "bg", NOW - 60 * MIN, NOW)).toBe(5);
  // another API's calls aren't these
  expect(await callsSince("cj", "user", NOW - 60 * MIN, NOW)).toBe(0);
});

test("only the calls inside the window count", async () => {
  await noteCall("impact", 4, NOW - 90 * MIN);
  await noteCall("impact", 1, NOW - 10 * MIN);
  expect(await callsSince("impact", "user", NOW - 60 * MIN, NOW)).toBe(1);
  expect(await callsSince("impact", "user", NOW - 120 * MIN, NOW)).toBe(5);
});

test("Google Books calls add up to a day's total, visitors and background", async () => {
  await noteCall("gbooks", 2, NOW);
  await asBackground(() => noteCall("gbooks", 3, NOW));
  expect(await gbooksToday(pacificDayOf(NOW))).toBe(5);
});
