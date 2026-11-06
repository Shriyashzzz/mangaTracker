import {
  volumeOfChapter,
  volumeStartsFrom,
} from "../../util/releases/volumeStarts.js";

const chapters = (...numbers: string[]) => ({
  chapters: Object.fromEntries(numbers.map((n) => [n, {}])),
});

test("a stray high chapter doesn't move a volume", () => {
  const starts = volumeStartsFrom({
    "1": chapters("1", "2", "232"),
    "2": chapters("3", "4"),
  });
  expect(volumeOfChapter(4, starts)).toBe(2);
  expect(volumeOfChapter(2, starts)).toBe(1);
});

test("a volume starting before the one ahead of it is dropped", () => {
  const starts = volumeStartsFrom({
    "1": chapters("1"),
    "2": chapters("10"),
    "3": chapters("5"),
    "4": chapters("20"),
  });
  expect(starts.map((s) => s.volume)).toEqual([1, 2, 4]);
});

test("unassigned chapters are ignored, and past the end is the last volume", () => {
  const starts = volumeStartsFrom({
    none: chapters("99"),
    "1": chapters("1"),
    "2": chapters("10"),
  });
  expect(volumeOfChapter(500, starts)).toBe(2);
});

test("no chapter, or one before everything, has no volume", () => {
  const starts = volumeStartsFrom({ "1": chapters("5") });
  expect(volumeOfChapter(null, starts)).toBeNull();
  expect(volumeOfChapter(0, starts)).toBeNull();
  expect(volumeOfChapter(2, starts)).toBeNull();
});
