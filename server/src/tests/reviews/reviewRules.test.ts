// The rules of readers' reviews (reviews/reviewRules.ts): who has read a
// volume, what a review's words may hold, when flags act, and how ratings
// are added up.
import {
  ASK_FOR_DAYS,
  finishedLately,
  hasLink,
  hasRead,
  latestVolume,
  mayAskAgain,
  ratingSpread,
  ratingSummary,
  readersSaySpoiler,
  reportedEnough,
  tidyWords,
} from "../../reviews/reviewRules.js";
import { scoresFrom } from "../../reviews/seriesScore.js";

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
  // too few to be a score: counted, not averaged
  expect(ratingSummary([5])).toEqual({ count: 1, average: null });
  expect(ratingSummary([5, 4, 4, 5])).toEqual({ count: 4, average: null });
  expect(ratingSummary([5, 4, 4, 5, 3])).toEqual({ count: 5, average: 4.2 });
  expect(ratingSummary([5, 4, 4], 3)).toEqual({ count: 3, average: 4.3 });
});

test("the spread: how many gave each rating, from 1 star to 5", () => {
  expect(ratingSpread([])).toEqual([0, 0, 0, 0, 0]);
  expect(ratingSpread([5, 5, 4, 2, 5])).toEqual([0, 1, 0, 1, 3]);
});

test("a finished volume is asked about for a few days, then not", () => {
  const now = new Date("2026-11-14T12:00:00Z");
  const daysAgo = (days: number) =>
    new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  expect(finishedLately(daysAgo(0), now)).toBe(true);
  expect(finishedLately(daysAgo(ASK_FOR_DAYS - 0.5), now)).toBe(true);
  expect(finishedLately(daysAgo(ASK_FOR_DAYS), now)).toBe(false);
  // never finished one, or closed the question
  expect(finishedLately(null, now)).toBe(false);
});

test("the page's stars are on the last volume read, or the nearest one we have a book for", () => {
  const theirs = [1, 2, 3, 5].map((volume) => ({ volume }));
  const reading = (readVolume: number | null, status = false) =>
    latestVolume({ status, readVolume }, theirs);
  // the volume they're on, not a later one they own
  expect(reading(2)).toEqual({ latest: { volume: 2 }, isTheOneRead: true });
  // a gap in our list, or past its end: the nearest below, and it isn't
  // the one they just read
  expect(reading(4)).toEqual({ latest: { volume: 3 }, isTheOneRead: false });
  expect(reading(9)).toEqual({ latest: { volume: 5 }, isTheOneRead: false });
  // finished: the last volume we know
  expect(reading(2, true)).toEqual({
    latest: { volume: 5 },
    isTheOneRead: true,
  });
  // only ticks what they own: the last of those
  expect(reading(null)).toEqual({ latest: { volume: 5 }, isTheOneRead: true });
  expect(reading(0)).toEqual({ latest: { volume: 5 }, isTheOneRead: true });
  // nothing of theirs at all
  expect(latestVolume({ status: false, readVolume: null }, [])).toEqual({
    latest: null,
    isTheOneRead: false,
  });
});

test("out loud is rare: once in so many days", () => {
  const now = new Date("2026-11-14T12:00:00Z");
  const daysAgo = (days: number) =>
    new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  // never asked
  expect(mayAskAgain(null, 30, now)).toBe(true);
  expect(mayAskAgain(daysAgo(1), 30, now)).toBe(false);
  expect(mayAskAgain(daysAgo(29.9), 30, now)).toBe(false);
  expect(mayAskAgain(daysAgo(30), 30, now)).toBe(true);
  // 0 days: every time
  expect(mayAskAgain(daysAgo(0), 0, now)).toBe(true);
});

test("a series' public score: one rating a reader, and only with enough of them", () => {
  const entry = (userId: number, name: string, rating: number | null) => ({
    userId,
    name,
    lightNovel: false,
    rating,
  });
  const scores = scoresFrom([
    // five readers, the name typed five ways that make the same address
    entry(1, "One Piece", 5),
    entry(2, "one piece", 4),
    entry(3, "ONE PIECE", 5),
    entry(4, "One-Piece", 4),
    entry(5, "One Piece!", 3),
    // the same reader twice counts once, by the higher rating
    entry(5, "One Piece", 5),
    // four readers: not a score yet
    entry(1, "Naruto", 5),
    entry(2, "Naruto", 5),
    entry(3, "Naruto", 5),
    entry(4, "Naruto", 5),
    // unrated entries don't count toward the five
    entry(5, "Naruto", null),
    entry(6, "Naruto", 0),
  ]);
  expect([...scores]).toEqual([["one-piece", 4.6]]);
  // a light novel is its own series, apart from the manga of the same name
  const novels = scoresFrom(
    [1, 2, 3, 4, 5].map((userId) => ({
      userId,
      name: "Overlord",
      lightNovel: true,
      rating: 4,
    })),
  );
  expect([...novels]).toEqual([["overlord-light-novel", 4]]);
});
