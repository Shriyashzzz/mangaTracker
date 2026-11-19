// Changes made offline, put together with the server's (src/offline/offlineRules.ts)
import { mergeOwned, mergePlace } from "../../offline/offlineRules.js";

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
