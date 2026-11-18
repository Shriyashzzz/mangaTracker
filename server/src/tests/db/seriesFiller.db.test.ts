// The background series lists (prices/seriesFiller.ts): which list is
// refreshed next, and standing aside when Google Books has no calls to
// spare. No catalog is called.
import {
  nextToRefresh,
  resetSeriesFiller,
  seriesTurn,
  type Listed,
} from "../../prices/seriesFiller.js";
import { noteCall } from "../../prices/callLog.js";
import { closeDb, emptyDb } from "./testDb.js";

const DAY_MS = 24 * 60 * 60_000;
const NOW = Date.now();
const daysAgo = (days: number) => NOW - days * DAY_MS;

const listed = (name: string, over: Partial<Listed>): Listed => ({
  name,
  popularityRank: null,
  finished: false,
  onShelf: false,
  listAt: daysAgo(1),
  ...over,
});

beforeEach(async () => {
  await emptyDb();
  resetSeriesFiller();
});
afterAll(closeDb);

test("a list is refreshed after a week if it's on a shelf or still running", () => {
  expect(nextToRefresh([listed("Fresh", { listAt: daysAgo(6) })], NOW)).toBe(
    null,
  );
  expect(nextToRefresh([listed("Running", { listAt: daysAgo(8) })], NOW)).toBe(
    "Running",
  );
  const onAShelf = listed("Owned", {
    finished: true,
    onShelf: true,
    listAt: daysAgo(8),
  });
  expect(nextToRefresh([onAShelf], NOW)).toBe("Owned");
});

test("a finished series nobody owns waits a month", () => {
  const done = (days: number) =>
    listed("Done", { finished: true, listAt: daysAgo(days) });
  expect(nextToRefresh([done(8)], NOW)).toBe(null);
  expect(nextToRefresh([done(31)], NOW)).toBe("Done");
});

test("shelf series go first, then the most popular", () => {
  const old = { listAt: daysAgo(10) };
  const series = [
    listed("Popular", { ...old, popularityRank: 1 }),
    listed("Unranked", old),
    listed("Owned", { ...old, popularityRank: 500, onShelf: true }),
  ];
  expect(nextToRefresh(series, NOW)).toBe("Owned");
  // one tried lately steps aside for the next
  expect(nextToRefresh(series, NOW, (name) => name !== "Owned")).toBe(
    "Popular",
  );
});

test("a list never looked up under its own name is due", () => {
  expect(nextToRefresh([listed("New", { listAt: null })], NOW)).toBe("New");
});

test("nothing is built or refreshed once Google Books has no calls to spare", async () => {
  await noteCall("gbooks", 1000);
  expect(await seriesTurn()).toBe("no room");
});
