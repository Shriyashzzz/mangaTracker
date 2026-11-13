// What finishing, or collecting, a series costs at stored prices
// (client/src/lib/finishCost.ts): the priced ones added up, the rest
// estimated at the series' usual price
import {
  finishCost,
  finishText,
  seriesCost,
  stillToGet,
  usedCopies,
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
    enough: true,
  });
  // one priced: the other counted at its price
  expect(finishCost([vol(3, 1099), vol(4, null)])).toEqual({
    cents: 1099,
    priced: 1,
    left: 2,
    estimateCents: 2198,
    // half the series priced: not enough to say a total
    enough: false,
  });
  // none of what's left priced, but owned ones are: estimated from those
  expect(
    finishCost([vol(3, null), vol(4, null)], [vol(1, 1000), vol(2, 1200)]),
  ).toMatchObject({ cents: 0, priced: 0, estimateCents: 2200 });
});

test("says it plainly: exact when all are priced, about otherwise", () => {
  expect(
    finishText(
      { cents: 2298, priced: 2, left: 2, estimateCents: 2298, enough: true },
      money,
    ),
  ).toBe("Finish the series: $22.98");
  expect(
    finishText(
      { cents: 1099, priced: 1, left: 3, estimateCents: 3297, enough: true },
      money,
    ),
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
    enough: true,
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
  // one of three priced: the other two at its price, but that's too few
  // of the series to say the total out loud
  expect(seriesCost([vol(1, 1000), vol(2, null), vol(3, null)])).toMatchObject({
    priced: 1,
    complete: false,
    estimateCents: 3000,
    enough: false,
  });
  // most of it priced (3 of 5): the estimate is said
  expect(
    seriesCost([
      vol(1, 1000),
      vol(2, 1000),
      vol(3, 1000),
      vol(4, null),
      vol(5, null),
    ]),
  ).toMatchObject({ priced: 3, estimateCents: 5000, enough: true });
});

test("a total is said only with most of the series priced, and an old price still counts", () => {
  const series = [1, 2, 3, 4, 5].map((n) => vol(n, n <= 2 ? 1000 : null));
  // 2 of 5 priced: a count, no money
  const few = finishCost(series.slice(2), series)!;
  expect(few.enough).toBe(false);
  expect(finishText(few, money)).toBe("Finish the series: check prices");
  // 3 of 5 is 60%
  const more = finishCost(series.slice(3), [
    ...series.slice(0, 2),
    vol(3, 1000),
    ...series.slice(3),
  ])!;
  expect(more.enough).toBe(true);
  // no store has it today, but it has sold for $12 before: still priced
  const recorded = [1, 2, 3].map((n) => ({
    volume: n,
    knownPriceCents: null,
    recordedCents: 1200,
  }));
  expect(finishCost(recorded.slice(1), recorded)).toMatchObject({
    cents: 2400,
    priced: 2,
    enough: true,
  });
});

test("used copies: only the ones on sale are added up, never a guess for the rest", () => {
  const volumes = [
    { isbn13: "1", usedCents: 596 },
    { isbn13: "2", usedCents: null },
    { isbn13: "3", usedCents: 724 },
    { isbn13: "4" },
  ];
  expect(usedCopies(volumes)).toEqual({ volumes: 2, cents: 1320 });
  // none on sale used: nothing to say
  expect(usedCopies([{ isbn13: "1", usedCents: null }])).toBeNull();
  expect(usedCopies([])).toBeNull();
});

test("used copies: a book holding two volumes is bought once", () => {
  // vols. 9 and 10 are one book: both count as found, the price once
  const volumes = [
    { isbn13: "book-5", usedCents: 900 },
    { isbn13: "book-5", usedCents: 900 },
    { isbn13: "single", usedCents: 500 },
  ];
  expect(usedCopies(volumes)).toEqual({ volumes: 3, cents: 1400 });
});
