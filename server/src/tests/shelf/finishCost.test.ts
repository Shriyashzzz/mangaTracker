// What finishing, or collecting, a series costs at stored prices
// (client/src/lib/finishCost.ts): the priced ones added up, the rest
// estimated at the series' usual price
import {
  finishCost,
  finishText,
  seriesCost,
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

test("adds up the priced ones and estimates the rest", () => {
  expect(finishCost([])).toBeNull();
  // nothing priced anywhere in the series: no total at all
  expect(finishCost([vol(3, null), vol(4, null)])).toBeNull();
  expect(finishCost([vol(3, 1099), vol(4, 1199)])).toEqual({
    cents: 2298,
    priced: 2,
    left: 2,
    estimateCents: 2298,
  });
  // one priced: the other counted at its price
  expect(finishCost([vol(3, 1099), vol(4, null)])).toEqual({
    cents: 1099,
    priced: 1,
    left: 2,
    estimateCents: 2198,
  });
  // none of what's left priced, but owned ones are: estimated from those
  expect(
    finishCost([vol(3, null), vol(4, null)], [vol(1, 1000), vol(2, 1200)]),
  ).toMatchObject({ cents: 0, priced: 0, estimateCents: 2200 });
});

test("says it plainly: exact when all are priced, about otherwise", () => {
  expect(
    finishText({ cents: 2298, priced: 2, left: 2, estimateCents: 2298 }, money),
  ).toBe("Finish the series: $22.98");
  expect(
    finishText({ cents: 1099, priced: 1, left: 3, estimateCents: 3297 }, money),
  ).toBe("Finish the series: about $30");
});

test("two volumes in one book are paid for once", () => {
  // Vinland Saga, Book 9 is vols 17 and 18: one $19.99 book
  const cost = finishCost([
    { isbn13: "9781632364456", knownPriceCents: 1999 },
    { isbn13: "9781632364456", knownPriceCents: 1999 },
    { isbn13: "9781632366306", knownPriceCents: 2099 },
  ]);
  expect(cost).toEqual({
    cents: 4098,
    priced: 3,
    left: 3,
    estimateCents: 4098,
  });
});

test("collecting a whole series: exact, or estimated from what's priced", () => {
  expect(seriesCost([vol(1, null)])).toBeNull();
  expect(seriesCost([vol(1, 1000), vol(2, 1200)])).toMatchObject({
    volumes: 2,
    cents: 2200,
    complete: true,
    estimateCents: 2200,
  });
  // one of three priced: the other two at its price
  expect(seriesCost([vol(1, 1000), vol(2, null), vol(3, null)])).toMatchObject({
    priced: 1,
    complete: false,
    estimateCents: 3000,
  });
});
