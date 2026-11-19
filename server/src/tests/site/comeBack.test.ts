// Coming back to the app after a while away (client/src/lib/comeBack.ts)
import { AWAY_MS, cameBack } from "../../../../client/src/lib/comeBack.js";

test("a minute or more away is coming back; a glance away isn't", () => {
  const left = 1_000_000;
  expect(cameBack(left, left + AWAY_MS)).toBe(true);
  expect(cameBack(left, left + 3 * 24 * 60 * 60 * 1000)).toBe(true);
  expect(cameBack(left, left + 5_000)).toBe(false);
  // never seen leaving (the page opened in the background)
  expect(cameBack(null, left)).toBe(false);
});
