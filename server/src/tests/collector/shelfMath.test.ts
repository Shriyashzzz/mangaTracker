// The shelf tools' arithmetic (collector/shelfMath.ts)
import {
  finishSeries,
  median,
  ownedSet,
  shelfValue,
  upcoming,
  type Copies,
  type ListedVolume,
} from "../../collector/shelfMath.js";

const vol = (
  volume: number | null,
  extra: Partial<ListedVolume> = {},
): ListedVolume => ({
  volume,
  isbn13: `978000000${String(volume ?? "x").padStart(4, "0")}`,
  title: `Series, Vol. ${volume}`,
  ...extra,
});
const copy = (cents: number) => ({ cents, store: "Store", url: null });
// what volumes have gone for used (getRecordedMedians)
const usedPrices = (entries: [ListedVolume, number][]) =>
  new Map(entries.map(([v, cents]) => [v.isbn13, { used: cents, new: null }]));
const priced = (entries: [ListedVolume, Partial<Copies>][]) =>
  new Map(entries.map(([v, c]) => [v.isbn13, { new: null, used: null, ...c }]));

const NOW = new Date("2026-11-10T12:00:00Z");

test("owned is up to N, or the exact list when it has gaps", () => {
  expect([...ownedSet({ volumesOwned: 3, ownedList: [] })]).toEqual([1, 2, 3]);
  expect([...ownedSet({ volumesOwned: 4, ownedList: [1, 4] })]).toEqual([1, 4]);
  expect(ownedSet({ volumesOwned: null, ownedList: [] }).size).toBe(0);
});

test("median", () => {
  expect(median([])).toBe(0);
  expect(median([500, 100, 300])).toBe(300);
  expect(median([100, 200])).toBe(150);
});

test("the shelf's value adds the owned volumes' used prices, and estimates the rest", () => {
  const v = [1, 2, 3, 4].map((n) => vol(n));
  const copies = usedPrices([
    [v[0]!, 500],
    [v[1]!, 700],
    // not owned: never counted
    [v[3]!, 9900],
  ]);
  const value = shelfValue(
    [{ owned: { volumesOwned: 3, ownedList: [] }, volumes: v }],
    copies,
  );
  expect(value).toEqual({
    cents: 1200,
    priced: 2,
    volumes: 3,
    unlisted: 0,
    estimateCents: 1200 + 600,
  });
});

test("a series with no used price is estimated at the shelf's usual; none priced, no estimate", () => {
  const a = [vol(1)];
  const b = [
    vol(1, { isbn13: "9780000009991" }),
    vol(2, { isbn13: "9780000009992" }),
  ];
  const copies = usedPrices([[a[0]!, 400]]);
  const value = shelfValue(
    [
      { owned: { volumesOwned: 1, ownedList: [] }, volumes: a },
      { owned: { volumesOwned: 2, ownedList: [] }, volumes: b },
    ],
    copies,
  );
  expect(value.estimateCents).toBe(400 + 400 * 2);
  expect(
    shelfValue(
      [{ owned: { volumesOwned: 2, ownedList: [] }, volumes: b }],
      new Map(),
    ).estimateCents,
  ).toBeNull();
});

test("one book holding two volumes is worth something once; specials never count", () => {
  const book = "9780000001111";
  const v = [
    vol(1, { isbn13: book }),
    vol(2, { isbn13: book }),
    vol(2.5),
    vol(0),
  ];
  const value = shelfValue(
    [{ owned: { volumesOwned: 3, ownedList: [] }, volumes: v }],
    usedPrices([[v[0]!, 900]]),
  );
  expect(value).toMatchObject({ cents: 900, volumes: 1 });
});

test("finishing a series: the volumes out they don't own, each with its cheapest new copy", () => {
  const v = [vol(1), vol(2), vol(3), vol(4, { published: "2027-02-01" })];
  const copies = priced([
    [v[1]!, { new: copy(1099) }],
    [v[0]!, { new: copy(999) }],
  ]);
  const f = finishSeries(
    { volumesOwned: 4, ownedList: [1, 4] },
    v,
    copies,
    NOW,
    1200,
  );
  // vol 4 isn't out yet: the calendar's, not missing
  expect(f.missing.map((m) => m.volume)).toEqual([2, 3]);
  expect(f.missing[0]!.cheapest?.cents).toBe(1099);
  expect(f).toMatchObject({ cents: 1099, priced: 1 });
  // vol 3 estimated at the series' usual new price (999 and 1099: 1049)
  expect(f.estimateCents).toBe(1099 + 1049);
});

test("with nothing priced anywhere, a series has no estimate", () => {
  const f = finishSeries(
    { volumesOwned: 1, ownedList: [] },
    [vol(1), vol(2)],
    new Map(),
    NOW,
    0,
  );
  expect(f.estimateCents).toBeNull();
  expect(f.missing).toHaveLength(1);
});

test("upcoming: dated volumes still to come within a year, soonest first", () => {
  const v = [
    vol(10, { published: "2027-03" }),
    vol(9, { published: "2026-12-15" }),
    vol(8, { published: "2026-10-01" }),
    vol(11, { published: "2028-06-01" }),
    vol(7),
  ];
  const up = upcoming(v, NOW);
  expect(up.map((u) => [u.volume, u.month])).toEqual([
    [9, "2026-12"],
    [10, "2027-03"],
  ]);
});

test("volumes the saved list skipped are still to go, unpriced", () => {
  // the list knows vols 1, 2 and 5; 3 and 4 are out too
  const v = [vol(1), vol(2), vol(5), vol(6, { published: "2027-04-01" })];
  const f = finishSeries(
    { volumesOwned: 1, ownedList: [] },
    v,
    new Map(),
    NOW,
    1000,
  );
  expect(f.missing.map((m) => [m.volume, m.isbn13 ? "book" : "none"])).toEqual([
    [2, "book"],
    [3, "none"],
    [4, "none"],
    [5, "book"],
  ]);
  // none of it priced: counted, with no total said
  expect(f.estimateCents).toBeNull();
});

test("a date given only to the month is still to come until the month is over", () => {
  const v = [vol(1), vol(2, { published: "2026-11" })];
  // November 10th: vol 2 may still be coming
  expect(
    finishSeries({ volumesOwned: 1, ownedList: [] }, v, new Map(), NOW).missing,
  ).toEqual([]);
  expect(upcoming(v, NOW).map((u) => u.volume)).toEqual([2]);
  // December: it's out
  const dec = new Date("2026-12-02T00:00:00Z");
  expect(
    finishSeries(
      { volumesOwned: 1, ownedList: [] },
      v,
      new Map(),
      dec,
    ).missing.map((m) => m.volume),
  ).toEqual([2]);
});

test("owned volumes of series with no saved list are estimated, so a total isn't exact", () => {
  const v = [vol(1)];
  const value = shelfValue(
    [{ owned: { volumesOwned: 1, ownedList: [] }, volumes: v }],
    usedPrices([[v[0]!, 500]]),
    3,
  );
  expect(value).toMatchObject({
    cents: 500,
    priced: 1,
    volumes: 1,
    unlisted: 3,
    estimateCents: 500 + 3 * 500,
  });
});

test("numbers below a volume known to be coming count as out", () => {
  const v = [vol(1), vol(2), vol(6, { published: "2027-04-01" })];
  const f = finishSeries(
    { volumesOwned: 2, ownedList: [] },
    v,
    new Map(),
    NOW,
    1000,
  );
  expect(f.missing.map((m) => m.volume)).toEqual([3, 4, 5]);
});

test("a used price recorded long ago still counts: it never goes stale", () => {
  const v = [vol(1)];
  // no copy in stock now, but it has sold used before
  const recorded = new Map([[v[0]!.isbn13, { used: 450, new: null }]]);
  expect(
    shelfValue(
      [{ owned: { volumesOwned: 1, ownedList: [] }, volumes: v }],
      recorded,
    ),
  ).toMatchObject({ cents: 450, priced: 1 });
});

test("an unpriced missing volume is estimated at its own recorded price first", () => {
  const v = [vol(1), vol(2), vol(3)];
  const copies = priced([[v[1]!, { new: copy(1000) }]]);
  const recorded = new Map([[v[2]!.isbn13, { used: null, new: 1500 }]]);
  const f = finishSeries(
    { volumesOwned: 1, ownedList: [] },
    v,
    copies,
    NOW,
    0,
    recorded,
  );
  // vol 2 priced now at 10.00; vol 3 at what it has gone for, 15.00
  expect(f.estimateCents).toBe(1000 + 1500);
});
