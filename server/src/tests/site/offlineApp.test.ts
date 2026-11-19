// The app's offline rules on the device: changes made offline combined per
// series, shown on the shelf meanwhile, and sent in the server's shape
// (client/src/lib/offlineChangeRules.ts); and what the offline bar says
// (client/src/components/offlineBar/offlineBarText.ts)
import {
  combinedOwned,
  combinedPlace,
  sentNote,
  toSend,
  withChanges,
  type OfflineChange,
} from "../../../../client/src/lib/offlineChangeRules.js";
import {
  keptText,
  offlineBarText,
} from "../../../../client/src/components/offlineBar/offlineBarText.js";
import type { Manga } from "../../../../client/src/lib/types.js";

const series = {
  id: 7,
  volumesOwned: 3,
  ownedList: [],
  bookmark: 20,
  readVolume: 2,
} as unknown as Manga;

test("many taps on one series are one change: the first start, the last end", () => {
  const first = combinedOwned(undefined, 7, [1, 2, 3], [1, 2, 3, 4], 100);
  const second = combinedOwned(first, 7, [1, 2, 3, 4], [1, 2, 4], 200);
  expect(second).toEqual({
    key: "7:owned",
    mangaId: 7,
    kind: "owned",
    started: [1, 2, 3],
    ended: [1, 2, 4],
    at: 200,
  });
  // a chapter moved 20 to 21 to 25: from 20, to 25
  const a = combinedPlace(undefined, 7, "bookmark", 20, 21, 100);
  const b = combinedPlace(a, 7, "bookmark", 21, 25, 200);
  expect([
    b.key,
    b.kind === "bookmark" && b.from,
    b.kind === "bookmark" && b.to,
  ]).toEqual(["7:bookmark", 20, 25]);
  // the volume read is its own change, beside the chapter
  const v = combinedPlace(b, 7, "readVolume", 2, 3, 300);
  expect(v.kind === "readVolume" && v.from).toBe(2);
});

test("the shelf shows a series as it is on this device", () => {
  const changes: OfflineChange[] = [
    combinedOwned(undefined, 7, [1, 2, 3], [1, 2, 3, 5], 1),
    combinedPlace(undefined, 7, "bookmark", 20, 22, 1),
    combinedPlace(undefined, 7, "readVolume", 2, 3, 1),
    // another series' change: not this one's
    combinedPlace(undefined, 9, "bookmark", 1, 99, 1),
  ];
  const shown = withChanges(series, changes);
  expect(shown).toMatchObject({
    ownedList: [1, 2, 3, 5],
    volumesOwned: 5,
    bookmark: 22,
    readVolume: 3,
  });
  // a run from 1 is just "up to"
  const run = withChanges(series, [
    combinedOwned(undefined, 7, [1, 2, 3], [1, 2, 3, 4], 1),
  ]);
  expect(run).toMatchObject({ volumesOwned: 4, ownedList: [] });
  expect(withChanges(series, [])).toBe(series);
});

test("what's sent leaves off what only this device keeps", () => {
  const owned = combinedOwned(undefined, 7, [1], [1, 2], 5);
  expect(toSend(owned)).toEqual({
    kind: "owned",
    mangaId: 7,
    started: [1],
    ended: [1, 2],
  });
  const place = combinedPlace(undefined, 7, "bookmark", null, 3, 5);
  expect(toSend(place)).toEqual({
    kind: "bookmark",
    mangaId: 7,
    from: null,
    to: 3,
  });
});

test("how a send went, in words", () => {
  expect(sentNote(1, 0)).toBe("Saved 1 change made offline.");
  expect(sentNote(3, 1)).toBe(
    "Saved 3 changes. 1 change made offline couldn't be saved.",
  );
  expect(sentNote(0, 2)).toBe("2 changes made offline couldn't be saved.");
});

test("the offline bar", () => {
  const now = new Date(2026, 10, 19, 14, 30).getTime();
  const at = new Date(2026, 10, 19, 14, 14).getTime();
  const base = {
    online: true,
    savedAt: null,
    waiting: 0,
    sending: false,
    note: null,
  };
  // all fresh: nothing
  expect(offlineBarText(base, now)).toBeNull();
  // offline, shelf kept at 2:14, two changes waiting
  expect(
    offlineBarText({ ...base, online: false, savedAt: at, waiting: 2 }, now),
  ).toEqual({
    tone: "offline",
    lead: "Offline.",
    text: "Your shelf as of 2:14 PM. 2 changes will save when you're back.",
  });
  // offline, nothing kept yet
  expect(offlineBarText({ ...base, online: false }, now)?.text).toBe(
    "Chapters and volumes you change save when you're back.",
  );
  // a kept copy on screen though the browser says online (the signal's bad)
  expect(offlineBarText({ ...base, savedAt: at }, now)?.tone).toBe("offline");
  // back: sending, then how it went
  expect(
    offlineBarText({ ...base, sending: true, waiting: 1 }, now)?.text,
  ).toBe("Saving 1 change made offline…");
  expect(
    offlineBarText({ ...base, note: "Saved 1 change made offline." }, now),
  ).toEqual({ tone: "note", text: "Saved 1 change made offline." });
  // a copy from another day says the day
  expect(keptText(new Date(2026, 10, 18, 9, 0).getTime(), now)).toBe("Nov 18");
});
