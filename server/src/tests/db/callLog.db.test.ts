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

const NOW = Date.parse("2026-11-15T22:07:00Z");
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
  // 22:07 UTC is the same Pacific day
  expect(await gbooksToday("2026-11-15")).toBe(5);
});
