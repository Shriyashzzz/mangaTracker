// A library rebind (Turtleback, Tandem Library) never stands in for the
// publisher's own paperback of a volume
import { isRebind, mergeVolumes } from "../../prices/service.js";
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
