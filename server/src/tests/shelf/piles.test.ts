// The New tab's piles (client/src/pages/Home/piles.ts): one, a few, way
// behind, for each kind
import {
  behindOf,
  catchUpText,
  sortPile,
  isPileView,
  pileOf,
  sortIntoPiles,
} from "../../../../client/src/pages/Home/piles.js";
import type { Manga, ReleaseStatus } from "../../../../client/src/lib/types.js";

const found = (over: Partial<ReleaseStatus> = {}) =>
  ({
    outVolumes: [],
    outJapanVolumes: [],
    latestChapter: null,
    nextChapter: null,
    ...over,
  }) as unknown as ReleaseStatus;
const vols = (...n: number[]) => n.map((volume) => ({ volume }));

test("one volume out is the first pile, however long it's been out", () => {
  expect(pileOf(found({ outVolumes: vols(16) }), "volumes")).toBe("one");
});

test("2 to 5 behind is a few, 6 or more is way behind", () => {
  expect(pileOf(found({ outVolumes: vols(2, 3) }), "volumes")).toBe("few");
  expect(pileOf(found({ outVolumes: vols(2, 3, 4, 5, 6) }), "volumes")).toBe(
    "few",
  );
  expect(pileOf(found({ outVolumes: vols(2, 3, 4, 5, 6, 7) }), "volumes")).toBe(
    "way",
  );
});

test("chapters: one, then a few up to 10", () => {
  const ch = (next: number, latest: number) =>
    found({ nextChapter: next, latestChapter: latest });
  expect(pileOf(ch(120, 120), "chapters")).toBe("one");
  expect(behindOf(ch(111, 120), "chapters")).toBe(10);
  expect(pileOf(ch(111, 120), "chapters")).toBe("few");
  expect(pileOf(ch(110, 120), "chapters")).toBe("way");
  // a half chapter as the newest still counts whole chapters
  expect(behindOf(ch(120, 120.5), "chapters")).toBe(1);
});

test("Japan goes by the volumes only out there", () => {
  expect(pileOf(found({ outJapanVolumes: [30] }), "japan")).toBe("one");
  expect(pileOf(found({ outJapanVolumes: [28, 29, 30] }), "japan")).toBe("few");
  expect(
    pileOf(found({ outJapanVolumes: [21, 22, 23, 24, 25, 26, 27] }), "japan"),
  ).toBe("way");
});

test("an unchecked series sits in the first pile rather than vanishing", () => {
  expect(pileOf(undefined, "volumes")).toBe("one");
});

test("sorting keeps every series once, in the list's order", () => {
  const m = (id: number) => ({ id, name: `S${id}` }) as Manga;
  const list = [m(1), m(2), m(3), m(4), m(5)];
  const piles = sortIntoPiles(
    list,
    {
      1: found({ outVolumes: vols(2, 3, 4, 5, 6, 7, 8) }),
      2: found({ outVolumes: vols(4) }),
      3: found({ outVolumes: vols(4, 5) }),
      4: found({ outVolumes: vols(9) }),
      5: found({ outVolumes: vols(9, 10, 11, 12, 13, 14) }),
    },
    "volumes",
  );
  expect(piles.one.map((x) => x.id)).toEqual([2, 4]);
  expect(piles.few.map((x) => x.id)).toEqual([3]);
  expect(piles.way.map((x) => x.id)).toEqual([1, 5]);
});

test("only known piles and all can be asked for in the address", () => {
  for (const ok of ["all", "one", "few", "way"])
    expect(isPileView(ok)).toBe(true);
  // "just-out" was a pile once: an old link to it falls back to the tab
  for (const bad of [null, "", "ALL", "way-behind", "just-out", "__proto__"])
    expect(isPileView(bad)).toBe(false);
});

test("a few and way behind say how much there is to catch up on", () => {
  const m = (id: number) => ({ id, name: `S${id}` }) as Manga;
  const releases = {
    1: found({ outVolumes: vols(2, 3, 4) }),
    2: found({ outVolumes: vols(5, 6) }),
  };
  expect(catchUpText("few", [m(1), m(2)], releases, "volumes")).toBe(
    " · 5 to catch up",
  );
  expect(catchUpText("one", [m(1)], releases, "volumes")).toBe("");
  const many = Array.from({ length: 300 }, (_, i) => m(i));
  const lots = Object.fromEntries(
    many.map((x) => [x.id, found({ outVolumes: vols(1, 2, 3, 4, 5, 6, 7) })]),
  );
  expect(catchUpText("way", many, lots, "volumes")).toBe(
    " · 2,100 in all",
  );
});

test("a pile's page sorts by how much there is to catch up on, or title", () => {
  const m = (id: number, name: string) => ({ id, name }) as Manga;
  const list = [m(1, "Bleach"), m(2, "Akira"), m(3, "Claymore")];
  const releases = {
    1: found({ outVolumes: vols(2, 3) }),
    2: found({ outVolumes: vols(2, 3, 4, 5, 6, 7, 8) }),
    3: found({ outVolumes: vols(9) }),
  };
  const ids = (sort: Parameters<typeof sortPile>[3]) =>
    sortPile(list, releases, "volumes", sort).map((x) => x.id);
  expect(ids("")).toEqual([1, 2, 3]);
  expect(ids("most")).toEqual([2, 1, 3]);
  expect(ids("least")).toEqual([3, 1, 2]);
  expect(ids("az")).toEqual([2, 1, 3]);
  // the shelf's own list is left as it was
  expect(list.map((x) => x.id)).toEqual([1, 2, 3]);
});
