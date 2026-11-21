// Which catalog books can be a series' single volumes (prices/singlesRules.ts)
import {
  editionIsbnsOf,
  editionsOwn,
  reissueOfOldVolume,
} from "../../prices/singlesRules.js";

test("a book an edition line holds is known by its ISBN, whatever its title", () => {
  const saved = [
    {
      key: "definitive",
      books: [
        { number: 8, isbn13: "9781974763023 " },
        { number: 9, isbn13: null },
      ],
    },
    { key: "vizbig", books: [{ number: 1, isbn13: "9781421522203" }] },
  ];
  const isbns = editionIsbnsOf(saved);
  expect(isbns.has("9781974763023")).toBe(true);
  expect(isbns.has("9781421522203")).toBe(true);
  expect(isbns.size).toBe(2);
  // nothing saved, or saved as a failure: none
  expect(editionIsbnsOf(null).size).toBe(0);
  expect(editionIsbnsOf([{ failed: true }]).size).toBe(0);
});

test("a gap answer dated after the later volumes is a reissue, not the single", () => {
  // Vagabond: vols. 9 to 37 out by 2014
  const byNumber = new Map<number | null, { year: number | null }>([
    [7, { year: 2003 }],
    [9, { year: 2004 }],
    [10, { year: 2004 }],
    [37, { year: 2014 }],
  ]);
  expect(reissueOfOldVolume({ volume: 8, year: 2027 }, byNumber)).toBe(true);
  // the real one, or one with no year: kept
  expect(reissueOfOldVolume({ volume: 8, year: 2004 }, byNumber)).toBe(false);
  expect(reissueOfOldVolume({ volume: 8, year: null }, byNumber)).toBe(false);
  // the newest volume of a running series has nothing after it to compare
  expect(reissueOfOldVolume({ volume: 38, year: 2027 }, byNumber)).toBe(false);
  // one later volume with a year proves nothing
  const one = new Map([[9, { year: 2004 }]]);
  expect(reissueOfOldVolume({ volume: 8, year: 2027 }, one)).toBe(false);
});

test("a lone volume an edition holds is its, but a book of several volumes stays", () => {
  const isbns = new Set(["9781974763023", "9781612624204"]);
  expect(editionsOwn(isbns, { isbn13: "9781974763023" })).toBe(true);
  // Vinland Saga's 2-in-1: the series' own English book
  expect(
    editionsOwn(isbns, {
      isbn13: "9781612624204",
      inBook: { book: 1, from: 1, to: 2 },
    }),
  ).toBe(false);
  expect(editionsOwn(isbns, { isbn13: "9781591160731" })).toBe(false);
});
