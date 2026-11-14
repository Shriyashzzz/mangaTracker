// The rules of readers' reviews (reviews/reviewRules.ts): who has read a
// volume, what a review's words may hold, when flags act, and how ratings
// are added up.
import {
  hasLink,
  hasRead,
  ratingSpread,
  ratingSummary,
  readersSaySpoiler,
  reportedEnough,
  tidyWords,
} from "../../reviews/reviewRules.js";

const place = (over: object = {}) => ({
  status: false,
  readVolume: null,
  volumesOwned: null,
  ownedList: [],
  ...over,
});

test("a reader has read a volume they own, have read up to, or whose series they finished", () => {
  // owns a run from 1 to 5
  expect(hasRead(place({ volumesOwned: 5 }), 5)).toBe(true);
  expect(hasRead(place({ volumesOwned: 5 }), 6)).toBe(false);
  // owns exactly vols. 1 and 4
  const odd = place({ volumesOwned: 4, ownedList: [1, 4] });
  expect(hasRead(odd, 4)).toBe(true);
  expect(hasRead(odd, 2)).toBe(false);
  // has read up to vol. 12, owning none
  expect(hasRead(place({ readVolume: 12 }), 12)).toBe(true);
  expect(hasRead(place({ readVolume: 12 }), 13)).toBe(false);
  // finished the series: every volume
  expect(hasRead(place({ status: true }), 40)).toBe(true);
  // on the shelf with nothing said: not yet
  expect(hasRead(place(), 1)).toBe(false);
});

test("a review's words can't carry a link", () => {
  for (const spam of [
    "great read https://cheap-manga.example",
    "see www.somewhere.net for more",
    "buy at cheapbooks.com today",
    "HTTP://SHOUTING.COM",
    "my shop is best-deals.shop",
  ])
    expect(hasLink(spam)).toBe(true);
  for (const fine of [
    "The fight in ch. 40 is the best in the series.",
    "Vol. 3 picks up. 5/5",
    "Slow start... then it never lets go",
    "A.K.A. the one with the tournament",
  ])
    expect(hasLink(fine)).toBe(false);
});

test("words are kept tidy", () => {
  expect(tidyWords("  Great   art.  \n\n\n\n Slow middle.  ")).toBe(
    "Great art.\n\nSlow middle.",
  );
  expect(tidyWords("   ")).toBe("");
});

test("two readers make it a spoiler, three reports hide it", () => {
  expect(readersSaySpoiler(1)).toBe(false);
  expect(readersSaySpoiler(2)).toBe(true);
  expect(reportedEnough(2)).toBe(false);
  expect(reportedEnough(3)).toBe(true);
});

test("ratings are counted, and averaged to one decimal place", () => {
  expect(ratingSummary([])).toEqual({ count: 0, average: null });
  expect(ratingSummary([5])).toEqual({ count: 1, average: 5 });
  expect(ratingSummary([5, 4, 4])).toEqual({ count: 3, average: 4.3 });
});

test("the spread: how many gave each rating, from 1 star to 5", () => {
  expect(ratingSpread([])).toEqual([0, 0, 0, 0, 0]);
  expect(ratingSpread([5, 5, 4, 2, 5])).toEqual([0, 1, 0, 1, 3]);
});
