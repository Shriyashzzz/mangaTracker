// What finishing, or collecting, a series costs at stored prices
// (client/src/lib/finishCost.ts): the priced ones added up, the rest
// estimated at the series' usual price
import {
  finishCost,
  finishText,
  runTotal,
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
  // two of three priced: the third at their middle price
  expect(seriesCost([vol(1, 1000), vol(2, 1200), vol(3, null)])).toMatchObject({
    priced: 2,
    complete: false,
    estimateCents: 3300,
  });
  // three of five priced: the other two at their middle price
  expect(
    seriesCost([
      vol(1, 1000),
      vol(2, 1000),
      vol(3, 1000),
      vol(4, null),
      vol(5, null),
    ]),
  ).toMatchObject({ priced: 3, estimateCents: 5000 });
});

test("a series total waits for half its books to be priced", () => {
  // one of three: mostly a guess, so no total (the box and descriptions skip it)
  expect(seriesCost([vol(1, 1000), vol(2, null), vol(3, null)])).toMatchObject({
    priced: 1,
    estimateCents: null,
  });
  // two of four is half: enough
  expect(
    seriesCost([vol(1, 1000), vol(2, 1000), vol(3, null), vol(4, null)]),
  ).toMatchObject({ estimateCents: 4000 });
  // two volumes in one book count as one book priced
  expect(
    seriesCost([
      { volume: 1, knownPriceCents: 2000, isbn13: "a" },
      { volume: 2, knownPriceCents: 2000, isbn13: "a" },
      { volume: 3, knownPriceCents: null, isbn13: "b" },
      { volume: 4, knownPriceCents: null, isbn13: "c" },
    ])?.estimateCents,
  ).toBeNull();
  expect(
    runTotal(seriesCost([vol(1, 1000), vol(2, null), vol(3, null)])),
  ).toBeNull();
  // used copies the same way: one of three on sale used says nothing
  expect(
    usedCopies([
      { isbn13: "1", usedCents: 500 },
      { isbn13: "2", usedCents: null },
      { isbn13: "3", usedCents: null },
    ]),
  ).toBeNull();
});

test("finishing their own series: any price is enough to estimate the rest, and an old price still counts", () => {
  const series = [1, 2, 3, 4, 5].map((n) => vol(n, n <= 2 ? 1000 : null));
  // 2 of 5 priced: the three to get at their $10
  const few = finishCost(series.slice(2), series)!;
  expect(finishText(few, money)).toBe("Finish the series: about $30");
  // no store has it today, but it has sold for $12 before: still priced
  const recorded = [1, 2, 3].map((n) => ({
    volume: n,
    knownPriceCents: null,
    recordedCents: 1200,
  }));
  expect(finishCost(recorded.slice(1), recorded)).toMatchObject({
    cents: 2400,
    priced: 2,
  });
});

test("used copies: the ones on sale added up, the rest at their middle price", () => {
  const volumes = [
    { isbn13: "1", usedCents: 596 },
    { isbn13: "2", usedCents: null },
    { isbn13: "3", usedCents: 724 },
    { isbn13: "4" },
  ];
  expect(usedCopies(volumes)).toEqual({
    volumes: 2,
    cents: 1320,
    // two more books at $6.60
    estimateCents: 1320 + 2 * 660,
    complete: false,
  });
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
  expect(usedCopies(volumes)).toEqual({
    volumes: 3,
    cents: 1400,
    estimateCents: 1400,
    complete: true,
  });
});
