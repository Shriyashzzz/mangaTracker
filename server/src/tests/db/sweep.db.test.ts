// The nightly sweep's limits (collector/sweep.ts) with a real database: what
// it may spend of eBay's day, when it's its time, when it stands aside for
// visitors, and its US/Canada split. No API is called.
import { jest } from "@jest/globals";
import config from "../../config/config.js";
import {
  LIMITS,
  ebayRoom,
  hoursUntilReset,
  isCanadasTurn,
  isEnglishIsbn,
  isSweepTime,
  nextSeries,
  shouldBackOff,
  sweepCeiling,
  usersWillNeed,
  sayWhy,
} from "../../collector/sweep.js";
import { spareCalls } from "../../collector/visitorPace.js";
import { noteCall } from "../../prices/callLog.js";
import { closeDb, emptyDb, prisma } from "./testDb.js";
import { monthOf, pacificDayOf, todayInPacificAt } from "./testClock.js";

// 10:30pm Pacific today, from the real clock (never a fixed date: see
// testClock.ts)
const NIGHT = todayInPacificAt(22, 30);
const DAY = pacificDayOf(NIGHT);

const setEbayUsed = (calls: number) =>
  prisma.$executeRaw`
    INSERT INTO api_usage (provider, month, calls)
    VALUES (${`ebay:${DAY}`}, ${monthOf(DAY)}::date, ${calls})
    ON CONFLICT (provider, month) DO UPDATE SET calls = ${calls}
  `;

beforeEach(emptyDb);
afterAll(closeDb);

test("the sweep may use 70% of what's left of eBay's day when it starts", () => {
  expect(sweepCeiling(4500, 1500)).toBe(1500 + 2100);
  // a day already used up: the ceiling is below it, so the sweep does nothing
  expect(sweepCeiling(4500, 4500)).toBe(3600);
  expect(LIMITS.ebayUsersShare).toBe(0.3);
});

test("it's the sweep's time from 8pm Pacific until the midnight reset", () => {
  expect(isSweepTime(NIGHT)).toBe(true);
  expect(isSweepTime(todayInPacificAt(20, 0))).toBe(true);
  expect(isSweepTime(todayInPacificAt(19, 59))).toBe(false);
  expect(hoursUntilReset(NIGHT)).toBeCloseTo(1.5);
});

test("the background's spare calls: what's left after visitors' share or their pace", () => {
  // 900 left, 300 kept, visitors heading for 450: 450 spare
  expect(spareCalls(900, 300, 450)).toBe(450);
  // a quiet day: only what's kept is held back
  expect(spareCalls(900, 300, 0)).toBe(600);
  // nothing spare once what's left is all visitors'
  expect(spareCalls(300, 300, 0)).toBe(0);
});

test("visitors' pace decides, and a sudden rush counts four times over", () => {
  // 100 an hour, 2 hours left: 200
  expect(usersWillNeed(100, 10, 2)).toBe(200);
  // 60 in the last 15 minutes is 240 an hour
  expect(usersWillNeed(100, 60, 2)).toBe(480);
  expect(shouldBackOff(480, 900)).toBe(false);
  expect(shouldBackOff(1000, 900)).toBe(true);
});

test("one volume in five is Canada's", () => {
  const canadian = Array.from({ length: 10 }, (_, i) => i).filter(
    isCanadasTurn,
  );
  expect(canadian).toHaveLength(2);
});

test("only English editions are priced", () => {
  expect(isEnglishIsbn("9781974709939")).toBe(true);
  expect(isEnglishIsbn("9798888439999")).toBe(true);
  expect(isEnglishIsbn("9784088820002")).toBe(false);
});

describe("eBay's room tonight", () => {
  const realLimit = config.EBAY_DAILY_LIMIT;
  beforeAll(() => {
    config.EBAY_DAILY_LIMIT = 4500;
  });
  afterAll(() => {
    config.EBAY_DAILY_LIMIT = realLimit;
  });

  test("room until tonight's ceiling, then spent", async () => {
    await setEbayUsed(1500);
    expect(await ebayRoom(NIGHT)).toBe("ok");
    // the ceiling was fixed when it started: 3,600
    await setEbayUsed(3600);
    expect(await ebayRoom(NIGHT)).toBe("spent");
  });

  test("it stands aside when visitors would need what's kept for them", async () => {
    await setEbayUsed(1500);
    expect(await ebayRoom(NIGHT)).toBe("ok");
    // 400 visitor calls in the last 15 minutes: 1,600 an hour, 1.5 hours
    // left, far over the 900 kept for them
    await noteCall("ebay", 400, NIGHT - 5 * 60_000);
    expect(await ebayRoom(NIGHT)).toBe("busy");
  });
});

test("never past 80% of eBay's day, where its title searches stop", () => {
  // 2,000 used at 10pm: 70% of the rest would reach 3,750 (83%)
  expect(sweepCeiling(4500, 2000)).toBe(3600);
  expect(sweepCeiling(4500, 3000)).toBe(3600);
  // already past it: nothing for the sweep
  expect(sweepCeiling(4500, 3700)).toBe(3600);
});

test("a series whose only unpriced volumes failed lately steps aside", () => {
  const series = [
    { name: "Blocked", volumes: [{ isbn13: "a1" }, { isbn13: "a2" }] },
    { name: "Next", volumes: [{ isbn13: "b1" }, { isbn13: "b2" }] },
  ];
  const never = new Set(["a2", "b1", "b2"]);
  // a2 failed lately: Blocked waits, Next gets its turn
  const failed = new Set(["a2"]);
  const picked = nextSeries(series, never, (isbn) => !failed.has(isbn));
  expect(picked.series?.name).toBe("Next");
  expect(picked.explore).toEqual(["b1", "b2"]);
  // once a2 is due again, Blocked is first
  expect(nextSeries(series, never, () => true).series?.name).toBe("Blocked");
});

test("visitors' calls are counted once: they're kept everything over the ceiling", async () => {
  await setEbayUsed(1500);
  // a steady 100 an hour, 1.5 hours left: 150, well within the 900 kept
  await noteCall("ebay", 100, NIGHT - 40 * 60_000);
  expect(await ebayRoom(NIGHT)).toBe("ok");
});

test("a night that prices nothing says why, once until it changes", async () => {
  const log = jest.spyOn(console, "log").mockImplementation(() => {});
  sayWhy("waiting");
  sayWhy("spent");
  sayWhy("spent");
  sayWhy("busy");
  sayWhy({ priced: 4 });
  sayWhy("spent");
  expect(log.mock.calls.map((c) => c[0])).toEqual([
    "Nightly price sweep: stopped, tonight's share of eBay's day is used up",
    "Nightly price sweep: paused 15 minutes, visitors are busy",
    "Nightly price sweep: priced 4 volumes",
    "Nightly price sweep: stopped, tonight's share of eBay's day is used up",
  ]);
  log.mockRestore();
});
