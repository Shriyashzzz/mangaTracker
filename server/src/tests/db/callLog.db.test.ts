// The call log (prices/callLog.ts) with a real database: visitors' calls and
// the background's are counted apart, five minutes at a time, and Google
// Books also gets a day's total. No API is called.
import {
  asBackground,
  callsSince,
  gbooksBackgroundLabel,
  gbooksByWho,
  gbooksDay,
  gbooksToday,
  googleBackgroundLeft,
  googleBooksReport,
  GOOGLE_BACKGROUND_DAILY,
  mayCallGoogle,
  noteCall,
} from "../../prices/callLog.js";
import { jest } from "@jest/globals";
import { closeDb, emptyDb, prisma } from "./testDb.js";
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

test("Google Books calls are counted a day by job, visitors apart", async () => {
  await noteCall("gbooks", 2, NOW);
  await asBackground(() => noteCall("gbooks", 3, NOW), "Edition lines");
  await asBackground(
    () => noteCall("gbooks", 1, NOW),
    "Background series lists",
  );
  expect(await gbooksByWho(pacificDayOf(NOW))).toEqual([
    { who: "edition-lines", calls: 3 },
    { who: "visitors", calls: 2 },
    { who: "background-series-lists", calls: 1 },
  ]);
});

test("the background jobs stop at their share of Google's day; visitors don't", async () => {
  const day = gbooksDay();
  expect(await googleBackgroundLeft()).toBe(true);
  await prisma.apiUsage.create({
    data: {
      provider: gbooksBackgroundLabel(day),
      month: new Date(`${day.slice(0, 7)}-01`),
      calls: GOOGLE_BACKGROUND_DAILY,
    },
  });
  expect(await googleBackgroundLeft()).toBe(false);
  expect(await asBackground(() => mayCallGoogle(), "Edition lines")).toBe(
    false,
  );
  // a visitor's page still asks
  expect(await mayCallGoogle()).toBe(true);
});

test("a finished day's Google calls are written to the log, by job", async () => {
  const yesterday = Date.now() - 24 * 60 * MIN;
  await noteCall("gbooks", 2, yesterday);
  await asBackground(() => noteCall("gbooks", 3, yesterday), "Edition lines");
  const log = jest.spyOn(console, "log").mockImplementation(() => {});
  await googleBooksReport(new Date());
  expect(log).toHaveBeenCalledWith(
    `Google Books on ${gbooksDay(new Date(yesterday))}: 5 calls (edition-lines 3, visitors 2)`,
  );
  log.mockRestore();
});
