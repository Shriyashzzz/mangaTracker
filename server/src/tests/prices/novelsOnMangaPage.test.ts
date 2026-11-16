// A finished manga page that picked up its light novel's volumes
// (prices/novelsOnMangaPage.ts): only with a novel behind it
import { withoutTheNovels } from "../../prices/novelsOnMangaPage.js";
import type { CatalogBook } from "../../prices/types.js";

const book = (volume: number, isbn13: string) =>
  ({
    isbn13,
    title: `Accel World, Vol. ${volume}`,
    authors: null,
    publisher: null,
    year: null,
    volume,
    coverUrl: "",
  }) as CatalogBook & { volume: number };
const range = (from: number, to: number) =>
  Array.from({ length: to - from + 1 }, (_, i) => from + i);
// the manga's 8, then the novels on from 9
const listed = range(1, 27).map((v) =>
  book(v, v <= 8 ? `manga-${v}` : `novel-${v}`),
);

test("a finished manga with a novel behind it: the novels go", () => {
  const novels = new Set(["novel-12", "novel-20", "manga-3x"]);
  expect(withoutTheNovels(listed, 8, novels).map((v) => v.volume)).toEqual(
    range(1, 8),
  );
  // a novel's book that slipped in among the manga's numbers goes too
  const slipped = listed.map((v) => (v.volume === 3 ? book(3, "novel-3") : v));
  expect(
    withoutTheNovels(slipped, 8, new Set(["novel-3", "novel-12"])).map(
      (v) => v.volume,
    ),
  ).toEqual([1, 2, 4, 5, 6, 7, 8]);
});

test("no novel behind it, a series still running, or only strays: as it was", () => {
  // Shaman King: Kodansha's 35 against AniList's 32, no novel
  const shamanKing = range(1, 35).map((v) => book(v, `kodansha-${v}`));
  expect(withoutTheNovels(shamanKing, 32, new Set())).toBe(shamanKing);
  // still coming out: no count
  expect(withoutTheNovels(listed, null, new Set(["novel-12"]))).toBe(listed);
  // one or two past the end are the strays rule's
  const two = range(1, 10).map((v) => book(v, `manga-${v}`));
  expect(withoutTheNovels(two, 8, new Set(["novel-12"]))).toBe(two);
});
