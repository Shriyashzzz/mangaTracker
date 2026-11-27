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
const copy = (cents: number) => ({
  cents,
  store: "Store",
  url: null,
  checkedAt: new Date("2026-11-01"),
});
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

test("an owned volume its series' list has no book for is still in the estimate", () => {
  // they own 1 to 4 and a 4.5 special; the list only has 1 to 3
  const v = [1, 2, 3].map((n) => vol(n));
  const copies = usedPrices([
    [v[0]!, 500],
    [v[1]!, 700],
  ]);
  const value = shelfValue(
    [
      {
        owned: { volumesOwned: 4.5, ownedList: [1, 2, 3, 4, 4.5] },
        volumes: v,
      },
    ],
    copies,
  );
  expect(value).toEqual({
    cents: 1200,
    priced: 2,
    // three with a book, two the list doesn't have
    volumes: 3,
    unlisted: 2,
    // the unpriced book and the two without one, each at the usual 600
    estimateCents: 1200 + 600 + 2 * 600,
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
  // none of it priced: each at the shelf's usual price, so the total is
  // still of all four
  expect(f.estimateCents).toBe(4 * 1000);
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

// ---------- books of a bigger edition they own ----------

// VIZBIG 1 holds vols. 1-3, and so on
const big = (
  n: number,
  from: number,
  to: number,
  edition = "omnibus",
): { isbn13: string; edition: string; volumes: number[] } => ({
  isbn13: `97811111${String(n).padStart(5, "0")}`,
  edition,
  volumes: Array.from({ length: to - from + 1 }, (_, i) => from + i),
});
const prices = (entries: [{ isbn13: string }, number][]) =>
  new Map(entries.map(([b, cents]) => [b.isbn13, { used: cents, new: null }]));

test("a series owned only in VIZBIGs is worth its VIZBIGs, not its singles", () => {
  const singles = [1, 2, 3, 4, 5, 6].map((n) => vol(n));
  const books = [big(1, 1, 3), big(2, 4, 6)];
  const value = shelfValue(
    [
      {
        owned: { volumesOwned: 6, ownedList: [] },
        volumes: singles,
        editionBooks: books,
      },
    ],
    prices([
      // the singles would fetch far more: never counted, none is owned
      ...singles.map((v) => [v, 3000] as [ListedVolume, number]),
      [books[0]!, 1500],
      [books[1]!, 1700],
    ]),
  );
  expect(value).toEqual({
    cents: 3200,
    priced: 2,
    volumes: 2,
    unlisted: 0,
    estimateCents: 3200,
  });
});

test("VIZBIGs and Definitives of one series both count, each at its own price", () => {
  const singles = [1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => vol(n));
  const vizbig = big(1, 1, 3);
  const definitive = big(50, 4, 9);
  const value = shelfValue(
    [
      {
        owned: { volumesOwned: 9, ownedList: [] },
        volumes: singles,
        editionBooks: [vizbig, definitive],
      },
    ],
    prices([
      [vizbig, 1500],
      [definitive, 4000],
    ]),
  );
  expect(value.cents).toBe(5500);
  expect(value.volumes).toBe(2);
  expect(value.estimateCents).toBe(5500);
});

test("singles and an omnibus: the omnibus's volumes aren't counted twice", () => {
  const singles = [1, 2, 3, 4, 5].map((n) => vol(n));
  const omnibus = big(3, 1, 3);
  const value = shelfValue(
    [
      {
        owned: { volumesOwned: 5, ownedList: [] },
        volumes: singles,
        editionBooks: [omnibus],
      },
    ],
    prices([
      [omnibus, 1200],
      [singles[3]!, 600],
      [singles[4]!, 800],
    ]),
  );
  // the omnibus, then vols. 4 and 5 as singles
  expect(value.cents).toBe(2600);
  expect(value.volumes).toBe(3);
});

test("an edition book never seen used is its volumes at a single's usual price", () => {
  const singles = [1, 2, 3, 4].map((n) => vol(n));
  const deluxe = big(4, 1, 2);
  const value = shelfValue(
    [
      {
        owned: { volumesOwned: 4, ownedList: [] },
        volumes: singles,
        editionBooks: [deluxe],
      },
    ],
    // the series' singles go for 500 used; vols. 3 and 4 are theirs as singles
    prices([
      [singles[0]!, 500],
      [singles[2]!, 500],
      [singles[3]!, 500],
    ]),
  );
  expect(value.cents).toBe(1000);
  expect(value.priced).toBe(2);
  expect(value.volumes).toBe(3);
  // the Deluxe as two volumes at 500 each
  expect(value.estimateCents).toBe(1000 + 1000);
});

test("an edition book whose volumes aren't all ticked any more isn't counted", () => {
  const singles = [1, 2, 3].map((n) => vol(n));
  const omnibus = big(5, 1, 3);
  const value = shelfValue(
    [
      {
        // vol. 3 unticked: the omnibus is gone, vols. 1 and 2 are singles
        owned: { volumesOwned: 2, ownedList: [] },
        volumes: singles,
        editionBooks: [omnibus],
      },
    ],
    prices([
      [omnibus, 9000],
      [singles[0]!, 500],
      [singles[1]!, 500],
    ]),
  );
  expect(value.cents).toBe(1000);
});

test("a book with no ISBN is estimated from their priced books of its kind", () => {
  const singles = [1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => vol(n));
  const one = big(1, 1, 3, "deluxe");
  const two = big(2, 4, 6, "deluxe");
  // Definitive 3: "not listed yet" when ticked, so no ISBN
  const three = { ...big(3, 7, 9, "deluxe"), isbn13: null };
  const value = shelfValue(
    [
      {
        owned: { volumesOwned: 9, ownedList: [] },
        volumes: singles,
        editionBooks: [one, two, three],
      },
    ],
    prices([
      // a volume inside them goes for 600 and 700: 650 the middle
      [one, 1800],
      [two, 2100],
      // the singles go for far less: not what a Definitive is worth
      ...singles.map((v) => [v, 300] as [ListedVolume, number]),
    ]),
  );
  expect(value.cents).toBe(3900);
  expect(value.priced).toBe(2);
  expect(value.volumes).toBe(3);
  expect(value.estimateCents).toBe(3900 + 3 * 650);
});

test("a book with no ISBN and no priced sibling: its volumes as singles go", () => {
  const singles = [1, 2, 3, 4].map((n) => vol(n));
  const lone = { ...big(1, 1, 2, "deluxe"), isbn13: null };
  const value = shelfValue(
    [
      {
        owned: { volumesOwned: 4, ownedList: [] },
        volumes: singles,
        editionBooks: [lone],
      },
    ],
    prices(singles.map((v) => [v, 500] as [ListedVolume, number])),
  );
  // vols. 3 and 4 as singles; the Deluxe as two volumes at 500
  expect(value.cents).toBe(1000);
  expect(value.volumes).toBe(3);
  expect(value.estimateCents).toBe(1000 + 1000);
});
