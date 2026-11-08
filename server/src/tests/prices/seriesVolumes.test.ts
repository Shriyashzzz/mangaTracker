import { pool } from "../../config/prisma.js";
import { mergeVolumes, needsGoogleShopping } from "../../prices/service.js";
import type { CatalogBook } from "../../prices/types.js";

afterAll(() => pool.end());

const book = (volume: number, isbn13 = `old-${volume}`) =>
  ({ volume, isbn13, title: `Vol. ${volume}` }) as CatalogBook;

test("a volume the catalog left out this time stays", () => {
  const merged = mergeVolumes([book(1), book(2), book(3)], [book(2, "new-2")]);
  expect(merged.map((v) => v.volume)).toEqual([1, 2, 3]);
});

test("the catalog's newest word on a volume wins, and new ones come in order", () => {
  const merged = mergeVolumes(
    [book(1), book(3)],
    [book(1, "new-1"), book(2, "new-2")],
  );
  expect(merged.map((v) => v.isbn13)).toEqual(["new-1", "new-2", "old-3"]);
});

test("nothing known and nothing found is an empty list", () => {
  expect(mergeVolumes([], [])).toEqual([]);
});

test("a volume sold on its own is never swapped for a book holding it", () => {
  const inBook = { ...book(3, "book-2"), inBook: { book: 2, from: 3, to: 4 } };
  // saved: the single vol 3; found now: only the two-volume book
  expect(mergeVolumes([book(3)], [inBook]).map((v) => v.isbn13)).toEqual([
    "old-3",
  ]);
  // the other way round, the single one takes its place
  expect(mergeVolumes([inBook], [book(3)]).map((v) => v.isbn13)).toEqual([
    "old-3",
  ]);
});

test("a listing that's really a book holding two volumes isn't a volume", () => {
  // Open Library: Vinland Saga's Book 6 is vols 11 and 12. Google Books calls
  // it "Vinland Saga 6", which reads as volume 6
  const in6 = (volume: number) => ({
    ...book(volume, "book-6"),
    inBook: { book: 6, from: 11, to: 12 },
  });
  const merged = mergeVolumes(
    [book(6, "vol-6"), in6(11), in6(12)],
    [book(6, "book-6")],
  );
  expect(merged.map((v) => [v.volume, v.isbn13])).toEqual([
    [6, "vol-6"],
    [11, "book-6"],
    [12, "book-6"],
  ]);
});

test("a known release date isn't lost to an answer without one", () => {
  const dated = { ...book(15, "frieren-15"), published: "2026-12-08" };
  const merged = mergeVolumes([dated], [book(15, "frieren-15")]);
  expect(merged[0]!.published).toBe("2026-12-08");
});

test("Google Shopping is asked only when no store found a print copy", () => {
  // eBay or Amazon found the paperback: no paid Google Shopping search
  expect(needsGoogleShopping([{ format: "print" }, { format: "ebook" }])).toBe(
    false,
  );
  // only Google Play's ebook, or nothing at all: ask it
  expect(needsGoogleShopping([{ format: "ebook" }])).toBe(true);
  expect(needsGoogleShopping([])).toBe(true);
});
