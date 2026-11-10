// The New tab's answers kept in the browser between visits
// (client/src/lib/releaseCache.ts): what's kept, what's used, when it's
// stale, how the server's saved answers merge in, and the time it says
import {
  checkedAgo,
  clearAnswers,
  loadAnswers,
  mergeSaved,
  saveAnswers,
  STALE_MS,
} from "../../../../client/src/lib/releaseCache.js";
import type { Manga, ReleaseStatus } from "../../../../client/src/lib/types.js";

// a browser's localStorage, for node
const store = new Map<string, string>();
Object.assign(globalThis, {
  localStorage: {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  },
});
beforeEach(() => store.clear());

const NOW = Date.parse("2026-11-10T12:00:00Z");
const HOUR = 60 * 60 * 1000;
const m = (id: number, over: Partial<Manga> = {}) =>
  ({ id, name: `S${id}`, volumesOwned: 3, bookmark: 10, ...over }) as Manga;
const status = (nextVolume: number) =>
  ({ hasNewVolume: true, nextVolume }) as unknown as ReleaseStatus;

test("answers come back for the same shelf, with when they were checked", () => {
  const shelf = [m(1), m(2)];
  saveAnswers(
    shelf,
    { 1: status(4), 2: null },
    { 1: "news", 2: "notFound" },
    { 1: NOW - HOUR, 2: NOW - 2 * HOUR },
  );
  const kept = loadAnswers(shelf, NOW);
  expect(kept.releases).toEqual({ 1: status(4), 2: null });
  expect(kept.outcomes).toEqual({ 1: "news", 2: "notFound" });
  expect(kept.checkedAt).toEqual({ 1: NOW - HOUR, 2: NOW - 2 * HOUR });
});

test("failed and unchecked answers aren't kept", () => {
  const shelf = [m(1), m(2), m(3)];
  saveAnswers(
    shelf,
    { 1: null, 2: status(4) },
    { 1: "failed", 2: "news" },
    { 1: NOW, 2: NOW },
  );
  expect(Object.keys(loadAnswers(shelf, NOW).releases)).toEqual(["2"]);
});

test("a series changed since its check is checked again", () => {
  saveAnswers([m(1)], { 1: status(4) }, { 1: "news" }, { 1: NOW });
  for (const changed of [
    m(1, { volumesOwned: 4 }),
    m(1, { bookmark: 11 }),
    m(1, { name: "Renamed" }),
    m(1, { lightNovel: true }),
    m(1, { seenVolume: 4 }),
    m(1, { hiddenVolumes: [4] }),
    m(1, { ownedList: [1, 2, 3, 5] }),
  ])
    expect(loadAnswers([changed], NOW).releases).toEqual({});
});

test("a week-old answer isn't shown at all", () => {
  saveAnswers(
    [m(1)],
    { 1: status(4) },
    { 1: "news" },
    { 1: NOW - 8 * 24 * HOUR },
  );
  expect(loadAnswers([m(1)], NOW).releases).toEqual({});
});

test("a series gone from the shelf leaves its answer behind", () => {
  saveAnswers(
    [m(1), m(2)],
    { 1: status(4), 2: status(5) },
    { 1: "news", 2: "news" },
    { 1: NOW, 2: NOW },
  );
  saveAnswers(
    [m(1)],
    { 1: status(4), 2: status(5) },
    { 1: "news", 2: "news" },
    { 1: NOW, 2: NOW },
  );
  expect(Object.keys(loadAnswers([m(1), m(2)], NOW).releases)).toEqual(["1"]);
});

test("clearing forgets everything; junk in storage is ignored", () => {
  saveAnswers([m(1)], { 1: status(4) }, { 1: "news" }, { 1: NOW });
  clearAnswers();
  expect(loadAnswers([m(1)], NOW).releases).toEqual({});
  store.set("releaseAnswers", "{not json");
  expect(loadAnswers([m(1)], NOW).releases).toEqual({});
  store.set("releaseAnswers", JSON.stringify({ v: 2, entries: {} }));
  expect(loadAnswers([m(1)], NOW).releases).toEqual({});
});

test("a full storage doesn't break anything", () => {
  const real = globalThis.localStorage.setItem;
  globalThis.localStorage.setItem = () => {
    throw new Error("QuotaExceededError");
  };
  expect(() =>
    saveAnswers([m(1)], { 1: status(4) }, { 1: "news" }, { 1: NOW }),
  ).not.toThrow();
  globalThis.localStorage.setItem = real;
});

test("the server's answers fill what the browser lacks, and replace older ones", () => {
  const merged = mergeSaved(
    {
      releases: { 1: status(4), 2: status(5) },
      outcomes: { 1: "news", 2: "news" },
      checkedAt: { 1: NOW - 10 * HOUR, 2: NOW - HOUR },
    },
    {
      // newer than the browser's: taken, and fresh
      1: {
        releaseStatus: status(6),
        outcome: "news",
        checkedAt: new Date(NOW - 2 * HOUR).toISOString(),
      },
      // older than the browser's: ignored
      2: {
        releaseStatus: status(1),
        outcome: "news",
        checkedAt: new Date(NOW - 5 * HOUR).toISOString(),
      },
      // the browser had nothing: taken
      3: {
        releaseStatus: null,
        outcome: "notFound",
        checkedAt: new Date(NOW - HOUR).toISOString(),
      },
      // bad date: ignored
      4: { releaseStatus: status(2), outcome: "news", checkedAt: "nonsense" },
    },
    NOW,
  );
  expect(merged.state.releases).toEqual({
    1: status(6),
    2: status(5),
    3: null,
  });
  expect(merged.state.outcomes[3]).toBe("notFound");
  expect(merged.state.checkedAt[1]).toBe(NOW - 2 * HOUR);
  expect(merged.fresh.sort()).toEqual([1, 3]);
});

test("a server answer older than the stale line fills in but isn't fresh", () => {
  const merged = mergeSaved(
    { releases: {}, outcomes: {}, checkedAt: {} },
    {
      1: {
        releaseStatus: null,
        outcome: "notFound",
        checkedAt: new Date(NOW - STALE_MS - HOUR).toISOString(),
      },
    },
    NOW,
  );
  expect(1 in merged.state.releases).toBe(true);
  expect(merged.fresh).toEqual([]);
});

test("how long ago, in plain words", () => {
  expect(checkedAgo(NOW - 30 * 1000, NOW)).toBe("just now");
  expect(checkedAgo(NOW + 5000, NOW)).toBe("just now");
  expect(checkedAgo(NOW - 25 * 60 * 1000, NOW)).toBe("25 min ago");
  expect(checkedAgo(NOW - 3 * HOUR, NOW)).toBe("3 h ago");
  expect(checkedAgo(NOW - 26 * HOUR, NOW)).toBe("yesterday");
  expect(checkedAgo(NOW - 72 * HOUR, NOW)).toBe("3 days ago");
});

test("partial answers aren't kept, so the next visit asks again", () => {
  saveAnswers(
    [m(1), m(2)],
    { 1: status(4), 2: status(5) },
    { 1: "news", 2: "news" },
    { 1: NOW, 2: NOW },
    new Set([2]),
  );
  expect(Object.keys(loadAnswers([m(1), m(2)], NOW).releases)).toEqual(["1"]);
});

test("kept answers drop the volume titles but keep what the New tab needs", () => {
  const full = {
    hasNewVolume: true,
    nextVolume: 4,
    outVolumes: [{ volume: 4, isbn13: "9781111111111", title: "A long title" }],
  } as unknown as ReleaseStatus;
  saveAnswers([m(1)], { 1: full }, { 1: "news" }, { 1: NOW });
  const kept = loadAnswers([m(1)], NOW).releases[1]!;
  expect(kept.outVolumes).toEqual([{ volume: 4, isbn13: "9781111111111" }]);
  expect(kept.nextVolume).toBe(4);
});

test("the release settings they were found with come back with them", () => {
  saveAnswers(
    [m(1)],
    { 1: status(4) },
    { 1: "news" },
    { 1: NOW },
    new Set(),
    '["on",null]',
  );
  expect(loadAnswers([m(1)], NOW).settings).toBe('["on",null]');
  saveAnswers([m(1)], { 1: status(4) }, { 1: "news" }, { 1: NOW });
  expect(loadAnswers([m(1)], NOW).settings).toBeNull();
});

test("a 2000 series shelf fits comfortably in the browser's storage", () => {
  const shelf = Array.from({ length: 2000 }, (_, i) =>
    m(i + 1, { name: `A fairly long series name number ${i}` }),
  );
  const big = {
    hasNewVolume: true,
    nextVolume: 2,
    outVolumes: Array.from({ length: 40 }, (_, v) => ({
      volume: v + 2,
      isbn13: "978111111" + String(v).padStart(4, "0"),
      title: "x".repeat(80),
    })),
    outJapanVolumes: [50, 51],
  } as unknown as ReleaseStatus;
  const ids = Object.fromEntries(shelf.map((s) => [s.id, big]));
  saveAnswers(
    shelf,
    ids,
    Object.fromEntries(shelf.map((s) => [s.id, "news" as const])),
    Object.fromEntries(shelf.map((s) => [s.id, NOW])),
  );
  // every series 40 volumes behind: far more than a real shelf
  expect(store.get("releaseAnswers")!.length).toBeLessThan(5_000_000);
});
