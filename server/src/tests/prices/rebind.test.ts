// A library rebind (Turtleback, Tandem Library) never stands in for the
// publisher's own paperback of a volume
import {
  isOmnibus,
  isOmnibusLength,
  isRebind,
  mergeVolumes,
} from "../../prices/service.js";
import type { CatalogBook } from "../../prices/types.js";

const vol = (isbn13: string, volume: number): CatalogBook => ({
  isbn13,
  title: `One Piece, Vol. ${volume}`,
  authors: null,
  publisher: null,
  year: null,
  volume,
  coverUrl: `/api/prices/cover/${isbn13}`,
});

test("Turtleback and Tandem Library ISBNs are rebinds", () => {
  expect(isRebind("9781417817689")).toBe(true);
  expect(isRebind("9780606123456")).toBe(true);
  expect(isRebind("9780613123456")).toBe(true);
  expect(isRebind("9781421548098")).toBe(false);
});

test("a saved list keeps the paperback when a rebind turns up", () => {
  const merged = mergeVolumes(
    [vol("9781421548098", 17)],
    [vol("9781417817689", 17)],
  );
  expect(merged.map((v) => v.isbn13)).toEqual(["9781421548098"]);
});

test("a rebind kept before gives way to the paperback", () => {
  const merged = mergeVolumes(
    [vol("9781417817689", 17)],
    [vol("9781421548098", 17)],
  );
  expect(merged.map((v) => v.isbn13)).toEqual(["9781421548098"]);
});

test("a 3-in-1 omnibus numbered like a volume is told by its length", () => {
  expect(isOmnibusLength({ pages: 584 })).toBe(true);
  expect(isOmnibusLength({ pages: 208 })).toBe(false);
  expect(isOmnibusLength({})).toBe(false);
  // a book holding two volumes is its own case (inBook), never dropped here
  expect(
    isOmnibusLength({ pages: 600, inBook: { book: 9, from: 17, to: 18 } }),
  ).toBe(false);
});

test("a book that calls itself 3-in-1 isn't a single volume, page count or not", () => {
  expect(isOmnibus({ title: "Hunter x Hunter (3-in-1 Edition), Vol. 2" })).toBe(
    true,
  );
  expect(isOmnibus({ title: "Ranma 1/2 (2-in-1 Edition), Vol. 5" })).toBe(true);
  expect(isOmnibus({ title: "Hunter x Hunter, Vol. 10", pages: 200 })).toBe(
    false,
  );
  // a series can come out as an "omnibus" and nothing else: left alone
  expect(isOmnibus({ title: "Planetes Omnibus Volume 1" })).toBe(false);
  // and a "1" beside "in" isn't it
  expect(isOmnibus({ title: "All You Need Is Kill, Vol. 1" })).toBe(false);
});
