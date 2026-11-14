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

test("unassigned chapters are ignored, and a little past the end is the last volume", () => {
  const starts = volumeStartsFrom({
    none: chapters("99"),
    "1": chapters("1"),
    "2": chapters("10"),
  });
  // the newest chapters, not in a book yet
  expect(volumeOfChapter(18, starts)).toBe(2);
  // far past where the list stops, we can't say: it isn't volume 2
  expect(volumeOfChapter(60, starts)).toBeNull();
  expect(volumeOfChapter(500, starts)).toBeNull();
});

test("no chapter, or one before everything, has no volume", () => {
  const starts = volumeStartsFrom({ "1": chapters("5") });
  expect(volumeOfChapter(null, starts)).toBeNull();
  expect(volumeOfChapter(0, starts)).toBeNull();
  expect(volumeOfChapter(2, starts)).toBeNull();
});

test("a chapter in a hole in the list isn't placed in the volume before the hole", () => {
  // vol. 1 starts at ch. 1, then nothing is known until vol. 15
  const holed = [
    { volume: 1, firstChapter: 1 },
    { volume: 15, firstChapter: 138 },
  ];
  expect(volumeOfChapter(60, holed)).toBeNull();
  // still in vol. 1 for sure
  expect(volumeOfChapter(5, holed)).toBe(1);
  // and with the next volume's start known, a long volume is still placed
  const whole = [
    { volume: 1, firstChapter: 1 },
    { volume: 2, firstChapter: 30 },
  ];
  expect(volumeOfChapter(25, whole)).toBe(1);
});
