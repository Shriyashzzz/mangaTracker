// "(vol. 5)" beside a chapter and "(ch. 43)" beside a volume, on a series'
// page (client lib/chapterVolumes.ts): only what the volume list is sure of
import {
  lastChapterOf,
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

test("a volume's last chapter needs the next volume's start", () => {
  expect(lastChapterOf(1, starts)).toBe(8);
  expect(lastChapterOf(2, starts)).toBe(17);
  // vol. 4 isn't known, nor anything after vol. 10
  expect(lastChapterOf(3, starts)).toBeNull();
  expect(lastChapterOf(10, starts)).toBeNull();
});
