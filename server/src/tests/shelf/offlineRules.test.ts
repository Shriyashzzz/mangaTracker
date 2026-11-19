// Changes made offline, put together with the server's (src/offline/offlineRules.ts)
import {
  mergeNotes,
  mergeOwned,
  mergePlace,
  mergeValue,
  readChange,
} from "../../offline/offlineRules.js";

test("only what was ticked or unticked offline is applied", () => {
  // offline: vol. 5 ticked. Meanwhile on the laptop: vol. 3 taken off
  expect(mergeOwned([1, 2, 4], [1, 2, 3, 4], [1, 2, 3, 4, 5])).toEqual([
    1, 2, 4, 5,
  ]);
  // offline: vol. 2 taken off. Meanwhile: vol. 9 ticked
  expect(mergeOwned([1, 2, 3, 9], [1, 2, 3], [1, 3])).toEqual([1, 3, 9]);
  // nothing changed elsewhere: it's just theirs
  expect(mergeOwned([1, 2], [1, 2], [1, 2, 3])).toEqual([1, 2, 3]);
  // sent twice (the app and the background both tried): the same
  const once = mergeOwned([1, 2], [1, 2], [1, 2, 3]);
  expect(mergeOwned(once, [1, 2], [1, 2, 3])).toEqual(once);
});

test("a place nobody else moved is theirs, back or forward", () => {
  expect(mergePlace(52, 52, 55)).toBe(55);
  // going back to fix a slip works offline too
  expect(mergePlace(52, 52, 48)).toBe(48);
  expect(mergePlace(null, null, 3)).toBe(3);
});

test("a place moved on another device meanwhile: the furthest wins", () => {
  // laptop went to 60, phone offline went 52 to 55
  expect(mergePlace(60, 52, 55)).toBe(60);
  // laptop went to 53, phone offline went to 58
  expect(mergePlace(53, 52, 58)).toBe(58);
  // sent twice: the same
  expect(mergePlace(mergePlace(52, 52, 55), 52, 55)).toBe(55);
});

test("finished, To read and the rating: theirs unless changed elsewhere", () => {
  // marked finished offline, nothing else touched it
  expect(mergeValue(false, false, true)).toBe(true);
  // un-finished on the laptop meanwhile... the laptop's newer choice stays
  expect(mergeValue(true, false, true)).toBe(true);
  expect(mergeValue(false, true, false)).toBe(false);
  // rated 4 offline; the laptop gave it 2 meanwhile: 2 stays
  expect(mergeValue(3, 3, 4)).toBe(4);
  expect(mergeValue(2, 3, 4)).toBe(2);
  // sent twice: the same
  expect(mergeValue(mergeValue(3, 3, 4), 3, 4)).toBe(4);
});

test("notes written offline are never lost", () => {
  // nobody else touched them: theirs, cleared too
  expect(mergeNotes("old", "old", "new")).toBe("new");
  expect(mergeNotes("old", "old", null)).toBe(null);
  // no note on the server now: theirs
  expect(mergeNotes(null, "old", "new")).toBe("new");
  // both edited: the other device's, then theirs, marked
  expect(mergeNotes("laptop", "old", "phone")).toBe(
    "laptop\n\nphone (written offline)",
  );
  // cleared offline but edited elsewhere: the other device's stay
  expect(mergeNotes("laptop", "old", null)).toBe("laptop");
  // sent twice: added once
  const once = mergeNotes("laptop", "old", "phone");
  expect(mergeNotes(once, "old", "phone")).toBe(once);
});

test("a change is checked by its kind before it's used", () => {
  expect(
    readChange({ kind: "status", mangaId: 3, from: false, to: true }),
  ).toEqual({ kind: "status", mangaId: 3, from: false, to: true });
  // no rating is 0 stars
  expect(readChange({ kind: "rating", mangaId: 3, from: null, to: 4 })).toEqual(
    {
      kind: "rating",
      mangaId: 3,
      from: 0,
      to: 4,
    },
  );
  // notes: trimmed, empty as none
  expect(
    readChange({ kind: "notes", mangaId: 3, from: "  ", to: " hi " }),
  ).toEqual({ kind: "notes", mangaId: 3, from: null, to: "hi" });
  expect(
    readChange({ kind: "bookmark", mangaId: 3, from: null, to: 12 }),
  ).toEqual({ kind: "bookmark", mangaId: 3, from: null, to: 12 });
  // refused: wrong kind, wrong types, too big, no series
  expect(readChange({ kind: "delete", mangaId: 3 })).toBeNull();
  expect(
    readChange({ kind: "status", mangaId: 3, from: "no", to: true }),
  ).toBeNull();
  expect(readChange({ kind: "rating", mangaId: 3, from: 0, to: 6 })).toBeNull();
  expect(
    readChange({ kind: "notes", mangaId: 3, from: null, to: "x".repeat(451) }),
  ).toBeNull();
  expect(
    readChange({ kind: "bookmark", mangaId: 0, from: 1, to: 2 }),
  ).toBeNull();
  expect(
    readChange({ kind: "owned", mangaId: 3, started: [1], ended: ["2"] }),
  ).toBeNull();
  expect(readChange(null)).toBeNull();
});
