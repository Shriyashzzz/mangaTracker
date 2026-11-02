import { pool } from "../config/prisma.js";
import { mergeVolumes } from "../prices/service.js";
import type { CatalogBook } from "../prices/types.js";

afterAll(() => pool.end());

const book = (volume: number, isbn13 = `old-${volume}`) =>
  ({ volume, isbn13, title: `Vol. ${volume}` }) as CatalogBook;

test("a volume the catalog left out this time stays", () => {
  const merged = mergeVolumes([book(1), book(2), book(3)], [book(2, "new-2")]);
  expect(merged.map((v) => v.volume)).toEqual([1, 2, 3]);
});

test("the catalog's newest word on a volume wins, and new ones come in order", () => {
  const merged = mergeVolumes([book(1), book(3)], [book(1, "new-1"), book(2, "new-2")]);
  expect(merged.map((v) => v.isbn13)).toEqual(["new-1", "new-2", "old-3"]);
});

test("nothing known and nothing found is an empty list", () => {
  expect(mergeVolumes([], [])).toEqual([]);
});
