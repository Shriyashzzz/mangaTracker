// the red mark on a series' volume shelf (client lib/chapterVolumes.ts):
// only what the volume list is sure of
import {
  placeOnShelf,
  volumeHolding,
} from "../../../../client/src/lib/chapterVolumes.js";

const starts = [
  { volume: 1, firstChapter: 1 },
  { volume: 2, firstChapter: 9 },
  { volume: 3, firstChapter: 18 },
  // a hole: nothing known for vols. 4 to 9
  { volume: 10, firstChapter: 80 },
];

test("a chapter is placed only between two known starts", () => {
  expect(volumeHolding(1, starts)).toBe(1);
  expect(volumeHolding(8, starts)).toBe(1);
  expect(volumeHolding(9, starts)).toBe(2);
  // in the hole, past the newest start, or nothing to go by: not said
  expect(volumeHolding(30, starts)).toBeNull();
  expect(volumeHolding(85, starts)).toBeNull();
  expect(volumeHolding(0, starts)).toBeNull();
  expect(volumeHolding(5, [])).toBeNull();
});

test("the shelf marks the volume read up to, else the one their chapter is in", () => {
  const chapters = { chapters: true, volumes: false };
  const volumes = { chapters: false, volumes: true };
  expect(
    placeOnShelf({ bookmark: 9, readVolume: null }, chapters, starts),
  ).toEqual({ volume: 2, kind: "reading" });
  expect(placeOnShelf({ bookmark: 0, readVolume: 3 }, volumes, starts)).toEqual(
    {
      volume: 3,
      kind: "read up to",
    },
  );
  // a chapter the list can't place: no mark
  expect(
    placeOnShelf({ bookmark: 30, readVolume: null }, chapters, starts),
  ).toBeNull();
});
