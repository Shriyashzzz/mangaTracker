// The app's offline rules on the device: changes made offline combined per
// series, shown on the shelf meanwhile, and sent in the server's shape
// (client/src/lib/offlineChangeRules.ts); and what the offline bar says
// (client/src/components/offlineBar/offlineBarText.ts)
import {
  changesNothing,
  combinedOwned,
  combinedChange,
  inOrder,
  sentNote,
  toSend,
  withChanges,
  type OfflineChange,
} from "../../../../client/src/lib/offlineChangeRules.js";
import { offlineBarText } from "../../../../client/src/components/offlineBar/offlineBarText.js";
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
  const a = combinedChange(undefined, 7, "bookmark", 20, 21, 100);
  const b = combinedChange(a, 7, "bookmark", 21, 25, 200);
  expect([
    b.key,
    b.kind === "bookmark" && b.from,
    b.kind === "bookmark" && b.to,
  ]).toEqual(["7:bookmark", 20, 25]);
  // the volume read is its own change, beside the chapter
  const v = combinedChange(b, 7, "readVolume", 2, 3, 300);
  expect(v.kind === "readVolume" && v.from).toBe(2);
});

test("the shelf shows a series as it is on this device", () => {
  const changes: OfflineChange[] = [
    combinedOwned(undefined, 7, [1, 2, 3], [1, 2, 3, 5], 1),
    combinedChange(undefined, 7, "bookmark", 20, 22, 1),
    combinedChange(undefined, 7, "readVolume", 2, 3, 1),
    // another series' change: not this one's
    combinedChange(undefined, 9, "bookmark", 1, 99, 1),
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
  const place = combinedChange(undefined, 7, "bookmark", null, 3, 5);
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
  const at = new Date(2026, 10, 19, 14, 14).getTime();
  const base = {
    online: true,
    savedAt: null,
    waiting: 0,
    sending: false,
    note: null,
  };
  // all fresh: nothing
  expect(offlineBarText(base)).toBeNull();
  // offline: just the word, whatever is waiting
  const offline = { tone: "offline", text: "Offline" };
  expect(offlineBarText({ ...base, online: false })).toEqual(offline);
  expect(
    offlineBarText({ ...base, online: false, savedAt: at, waiting: 2 }),
  ).toEqual(offline);
  // a kept copy on screen though the browser says online (the signal's bad)
  expect(offlineBarText({ ...base, savedAt: at })).toEqual(offline);
  // back: sending, then how it went
  expect(offlineBarText({ ...base, sending: true, waiting: 1 })?.text).toBe(
    "Saving 1 change made offline…",
  );
  expect(
    offlineBarText({ ...base, note: "Saved 1 change made offline." }),
  ).toEqual({ tone: "note", text: "Saved 1 change made offline." });
});

test("finished, To read, rating and notes are shown as the server will save them", () => {
  const base = {
    ...series,
    status: false,
    planned: true,
    bookmark: 0,
    rating: 3,
    description: "old",
  } as Manga;
  const toRead = { status: false, planned: true };
  const reading = { status: false, planned: false };
  const finished = { status: true, planned: false };
  const changes = [
    combinedChange(undefined, 7, "rating", 3, 5, 30),
    combinedChange(undefined, 7, "state", toRead, finished, 20),
    combinedChange(undefined, 7, "notes", "old", "on a train", 40),
  ];
  expect(withChanges(base, changes)).toMatchObject({
    planned: false,
    status: true,
    rating: 5,
    description: "on a train",
  });
  // sent in the order made, whatever order they were kept in
  expect(inOrder(changes).map((c) => c.kind)).toEqual([
    "state",
    "rating",
    "notes",
  ]);
  // started reading: off To read, at chapter 1
  expect(
    withChanges(base, [
      combinedChange(undefined, 7, "state", toRead, reading, 1),
    ]),
  ).toMatchObject({ planned: false, status: false, bookmark: 1 });
  // finished, then back to reading: one change, off To read as online
  const once = combinedChange(undefined, 7, "state", toRead, finished, 1);
  const twice = combinedChange(once, 7, "state", finished, reading, 2);
  expect(twice).toMatchObject({ from: toRead, to: reading });
  expect(changesNothing(twice)).toBe(false);
  // finished, then Undo back onto To read: nothing to send
  const undone = combinedChange(once, 7, "state", finished, toRead, 2);
  expect(changesNothing(undone)).toBe(true);
});

test("a change taken back is nothing to send", () => {
  const rated = combinedChange(undefined, 7, "rating", 3, 5, 1);
  const back = combinedChange(rated, 7, "rating", 5, 3, 2);
  expect(changesNothing(back)).toBe(true);
  expect(changesNothing(rated)).toBe(false);
  expect(toSend(rated)).toEqual({ kind: "rating", mangaId: 7, from: 3, to: 5 });
});
