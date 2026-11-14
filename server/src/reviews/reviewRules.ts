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
// a reader can write words about this many different volumes in an hour.
// Changing one they've written is always allowed, and so is a rating with
// no words, however many
export const REVIEWS_AN_HOUR = 6;

// a series' page asks about a volume for this many days after they finish
// it; then the question steps back to the small stars
export const ASK_FOR_DAYS = 3;
const DAY_MS = 24 * 60 * 60 * 1000;
// Did they finish a volume lately enough to be asked about it? `finishedAt`
// is the series' readVolumeAt: null when they never have, or closed it
export const finishedLately = (finishedAt: Date | null, now = new Date()) =>
  finishedAt !== null &&
  now.getTime() - finishedAt.getTime() < ASK_FOR_DAYS * DAY_MS;

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

// Out loud is rare: at most once in `everyDays` per reader, across all
// their series. `lastAskedAt` is the account's rateAskedAt
export const mayAskAgain = (
  lastAskedAt: Date | null,
  everyDays: number,
  now = new Date(),
) =>
  lastAskedAt === null ||
  now.getTime() - lastAskedAt.getTime() >= everyDays * DAY_MS;

// Which volume a series' page puts its stars on: the last one they've read.
// `theirs` are the volumes of the series we have a book for that they own
// or have read.
//   finished the series        the last volume we know
//   keeps the volume they're on   that volume. When we have no book for it
//                              (it's past the end of our list, or in a gap)
//                              the nearest one below that we do have, and
//                              `isTheOneRead` is false: there's nothing to
//                              ask about the volume they just finished
//   only ticks what they own   the last one they own
export function latestVolume<V extends { volume: number }>(
  place: { status: boolean; readVolume: number | null },
  theirs: V[],
): { latest: V | null; isTheOneRead: boolean } {
  const last = (volumes: V[]) =>
    volumes.reduce<V | null>(
      (best, one) => (best && best.volume >= one.volume ? best : one),
      null,
    );
  const readVolume = place.readVolume ?? 0;
  if (place.status || readVolume < 1) {
    const latest = last(theirs);
    return { latest, isTheOneRead: latest !== null };
  }
  const latest = last(theirs.filter((one) => one.volume <= readVolume));
  return { latest, isTheOneRead: latest?.volume === readVolume };
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

// a score is only shown once this many readers have rated: one or two
// ratings say more about those readers than about the book
export const ENOUGH_RATINGS = 5;

// Ratings added up: how many, and their average to one decimal place. The
// average is null until there are enough of them (ENOUGH_RATINGS), so no
// page, cover or search engine gets a score from a handful
export function ratingSummary(ratings: number[], enough = ENOUGH_RATINGS) {
  if (ratings.length < Math.max(enough, 1))
    return { count: ratings.length, average: null };
  const total = ratings.reduce((sum, rating) => sum + rating, 0);
  return {
    count: ratings.length,
    average: Math.round((total / ratings.length) * 10) / 10,
  };
}
