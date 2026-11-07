// What finishing a series costs at stored prices (client/src/lib/finishCost.ts)
import {
  finishCost,
  finishText,
  stillToGet,
} from "../../../../client/src/lib/finishCost.js";

const money = (cents: number) => `$${(cents / 100).toFixed(2)}`;
const vol = (volume: number, knownPriceCents: number | null) => ({
  volume,
  knownPriceCents,
});

test("still to get: what they don't own, and halves always count", () => {
  const out = [vol(1, 999), vol(2, 999), vol(3, 999), vol(3.5, 999)];
  const left = (owned: { volumesOwned: number | null; ownedList?: number[] }) =>
    stillToGet(out, owned).map((v) => v.volume);
  expect(left({ volumesOwned: 2 })).toEqual([3, 3.5]);
  expect(left({ volumesOwned: 3, ownedList: [1, 3] })).toEqual([2, 3.5]);
  expect(left({ volumesOwned: null })).toEqual([1, 2, 3, 3.5]);
});

test("adds up the priced ones and counts the rest", () => {
  expect(finishCost([])).toBeNull();
  // nothing priced yet: no total at all
  expect(finishCost([vol(3, null), vol(4, null)])).toBeNull();
  expect(finishCost([vol(3, 1099), vol(4, 1199)])).toEqual({
    cents: 2298,
    priced: 2,
    left: 2,
  });
  expect(finishCost([vol(3, 1099), vol(4, null)])).toEqual({
    cents: 1099,
    priced: 1,
    left: 2,
  });
});

test("says it plainly, and never claims a full total it doesn't have", () => {
  expect(finishText({ cents: 2298, priced: 2, left: 2 }, money)).toBe(
    "Finish the series: $22.98",
  );
  expect(finishText({ cents: 1099, priced: 1, left: 3 }, money)).toBe(
    "Finish the series: $10.99 for 1 of 3 · 2 not priced yet",
  );
});
