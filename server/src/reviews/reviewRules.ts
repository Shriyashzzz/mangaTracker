// The rules of readers' reviews, with no database and no network, so they
// can be tested by themselves:
//   who may review a volume (someone who owns it or has read it),
//   what a review's words may hold (no links),
//   when readers' flags hide a review or mark it a spoiler,
//   and how a volume's or a series' ratings are added up.
import { ownedSet } from "../collector/shelfMath.js";

export const MOST_WORDS = 500;
// this many readers saying "spoiler" puts a review behind a tap
export const SPOILER_FLAGS = 2;
// this many reports hide a review until the site's owner has looked
export const REPORTS_TO_HIDE = 3;
// a reader can review this many different volumes in an hour (changing one
// they've written is always allowed)
export const REVIEWS_AN_HOUR = 6;

export type FlagKind = "spoiler" | "report";

// a series on a reader's shelf, as much of it as the rule needs
export type ShelfPlace = {
  // finished reading the whole series
  status: boolean;
  // the last volume they've read
  readVolume: number | null;
  volumesOwned: number | null;
  ownedList: number[];
};

// Has this reader read the volume, as far as their shelf says? They own it,
// or they've read up to it, or they've finished the series. Someone who
// keeps their place by the chapter and owns nothing isn't counted: a chapter
// can't be turned into a volume here
export function hasRead(place: ShelfPlace, volume: number) {
  if (place.status) return true;
  if (place.readVolume !== null && place.readVolume >= volume) return true;
  return ownedSet(place).has(volume);
}

// a web address, a "www." or a bare "something.com/…": the usual shapes of
// spam. Written loosely on purpose: a review has no need of any of them
const LINK =
  /https?:\/\/|www\.|\b[a-z0-9-]+\.(com|net|org|io|xyz|co|ru|cn|info|biz|shop|site|top|link|ly|gg|me)\b/i;
export const hasLink = (text: string) => LINK.test(text);

// a review's words as kept: trimmed, runs of blank lines and spaces closed up
export const tidyWords = (text: string) =>
  text
    .replace(/[ \t]+/g, " ")
    .replace(/\s*\n\s*\n\s*/g, "\n\n")
    .trim();

// readers have called it a spoiler often enough for it to go behind a tap,
// whatever its writer said
export const readersSaySpoiler = (spoilerFlags: number) =>
  spoilerFlags >= SPOILER_FLAGS;

// reported often enough to be hidden until the site's owner has looked
export const reportedEnough = (reports: number) => reports >= REPORTS_TO_HIDE;

// how many gave each rating, from 1 star to 5: [0, 1, 1, 3, 7]
export function ratingSpread(ratings: number[]) {
  const spread = [0, 0, 0, 0, 0];
  for (const rating of ratings) {
    const at = rating - 1;
    if (at >= 0 && at < spread.length) spread[at] = spread[at]! + 1;
  }
  return spread;
}

// ratings added up: how many, and their average to one decimal place; null
// with none
export function ratingSummary(ratings: number[]) {
  if (!ratings.length) return { count: 0, average: null };
  const total = ratings.reduce((sum, rating) => sum + rating, 0);
  return {
    count: ratings.length,
    average: Math.round((total / ratings.length) * 10) / 10,
  };
}
