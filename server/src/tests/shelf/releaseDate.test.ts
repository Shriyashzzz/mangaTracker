// A volume not out yet isn't on sale (client/src/lib/releaseDate.ts)
import {
  notOutYet,
  onSale,
  outLongAgo,
} from "../../../../client/src/lib/releaseDate.js";

const today = new Date(2026, 10, 7);

test("a release date still to come isn't on sale yet", () => {
  expect(notOutYet("2026-12-08", today)).toBe(true);
  expect(notOutYet("2027-01", today)).toBe(true);
  expect(notOutYet("2026-11-01", today)).toBe(false);
  expect(notOutYet(undefined, today)).toBe(false);
});

test("on sale: everything but the preorders", () => {
  const volumes = [
    { volume: 14 },
    { volume: 15, published: "2099-12-08" },
    { volume: 13, published: "2020-01-01" },
  ];
  expect(onSale(volumes).map((v) => v.volume)).toEqual([14, 13]);
});

test("out long ago: over 45 days, and only by a full release day", () => {
  // an old volume a collector's list only now added isn't news
  expect(outLongAgo("2008-03-11", today)).toBe(true);
  expect(outLongAgo("2026-10-30", today)).toBe(false);
  expect(outLongAgo("2026-09-20", today)).toBe(true);
  // a month alone, or no date, isn't known to be old
  expect(outLongAgo("2008-03", today)).toBe(false);
  expect(outLongAgo(undefined, today)).toBe(false);
  // a preorder isn't out at all
  expect(outLongAgo("2027-01-05", today)).toBe(false);
});
