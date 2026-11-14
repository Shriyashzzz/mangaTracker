// Readers' reviews of a volume, as the pages ask for them: a volume's
// reviews with whether this reader may write one, writing and flagging, and
// a series' ratings added up. The rules are reviewRules.ts; the database is
// reviewStore.ts.
import { prisma } from "../config/prisma.js";
import { shelfSeries } from "../collector/shelfSeries.js";
import { AppError, NotFoundError } from "../errors/AppError.js";
import { priceName } from "../prices/lightNovel.js";
import { knownSeriesName } from "../prices/sources/anilist.js";
import { seriesName, slugify } from "../prices/stores/match.js";
import { titleVolume } from "../prices/volumeNames.js";
import { defaultReaderName } from "../util/shelf/readerNames.js";
import {
  hasLink,
  hasRead,
  ratingSpread,
  ratingSummary,
  readersSaySpoiler,
  reportedEnough,
  REVIEWS_AN_HOUR,
  tidyWords,
  type FlagKind,
} from "./reviewRules.js";
import * as store from "./reviewStore.js";

type StoredReview = Awaited<ReturnType<typeof store.reviewsOfVolume>>[number];

// a review as a page gets it. Never the writer's username or account id
const sent = (review: StoredReview, viewerId: number | null) => ({
  id: review.id,
  rating: review.rating,
  text: review.body,
  // behind a tap: its writer said so, or enough readers did
  spoiler: review.spoiler || readersSaySpoiler(review._count.flags),
  // the name others see: their display name, or the stand-in a shared
  // shelf gives them
  by: review.user.displayName || defaultReaderName(review.user.id),
  avatar: review.user.avatar,
  writtenAt: review.createdAt,
  edited: review.updatedAt.getTime() - review.createdAt.getTime() > 60_000,
  yours: review.userId === viewerId,
  // only its writer is sent a hidden one, and told so
  hidden: review.status !== "shown",
});
export type SentReview = ReturnType<typeof sent>;

// Where a volume sits on a reader's shelf: the series it's part of there,
// and its number. Null when it's in none of their series. Found through the
// saved volume lists (as the shelf's own tools do), and failing that by the
// book's title
async function shelfPlaceOf(userId: number, isbn13: string) {
  const manga = await prisma.manga.findMany({ where: { userId } });
  for (const series of await shelfSeries(manga)) {
    const listed = series.volumes.find(
      (volume) => volume.isbn13?.trim() === isbn13 && volume.volume !== null,
    );
    if (listed) return { manga: series.manga, volume: listed.volume! };
  }
  const book = await prisma.book.findUnique({ where: { isbn13 } });
  const number = book ? titleVolume(book.title) : null;
  if (!book || number === null) return null;
  const slug = slugify(seriesName(book.title));
  const named = manga.find((one) => slugify(priceName(one)) === slug);
  return named ? { manga: named, volume: number } : null;
}

// may this reader review this volume? "yes", or why not
export type MayWrite = "yes" | "sign-in" | "not-read";
async function mayWrite(userId: number | null, isbn13: string) {
  if (!userId) return "sign-in" as const;
  const place = await shelfPlaceOf(userId, isbn13);
  const read = place !== null && hasRead(place.manga, place.volume);
  return read ? ("yes" as const) : ("not-read" as const);
}

// a volume's reviews for one viewer (null: nobody signed in)
export async function volumeReviews(isbn13: string, viewerId: number | null) {
  const [stored, allowed] = await Promise.all([
    store.reviewsOfVolume(isbn13, viewerId),
    mayWrite(viewerId, isbn13),
  ]);
  const shown = stored.filter((review) => review.status === "shown");
  const yours = stored.find((review) => review.userId === viewerId);
  return {
    // every shown rating counts; the list is the ones with words
    ...ratingSummary(shown.map((review) => review.rating)),
    // how many gave 1 star, 2 … 5, for the page's bars
    spread: ratingSpread(shown.map((review) => review.rating)),
    reviews: shown
      .filter((review) => review.body)
      .map((review) => sent(review, viewerId)),
    yours: yours ? sent(yours, viewerId) : null,
    mayWrite: allowed,
  };
}

export type NewReview = { rating: number; text: string; spoiler: boolean };

// writes a reader's review of a volume, or writes over the one they have
export async function writeReview(
  userId: number,
  isbn13: string,
  { rating, text, spoiler }: NewReview,
) {
  const body = tidyWords(text);
  if (hasLink(body))
    throw new AppError(
      "Reviews can't have links. Take it out and try again.",
      400,
    );
  const place = await shelfPlaceOf(userId, isbn13);
  if (!place || !hasRead(place.manga, place.volume))
    throw new AppError(
      "Mark this volume as owned or read on your shelf first.",
      403,
    );
  if ((await store.writtenLately(userId, isbn13)) >= REVIEWS_AN_HOUR)
    throw new AppError("That's a lot of reviews. Try again in an hour.", 429);
  const saved = await store.saveReview({
    userId,
    isbn13,
    // the series as the price pages name it (AniList's own name for it,
    // where the shelf has it under another), so a series' page finds them
    seriesSlug: slugify(await knownSeriesName(priceName(place.manga))),
    volume: place.volume,
    rating,
    body,
    spoiler: spoiler && body !== "",
  });
  return sent(saved, userId);
}

export const deleteReview = (userId: number, isbn13: string) =>
  store.deleteOwnReview(userId, isbn13);

// another reader says a review is a spoiler, or reports it. Enough reports
// hide it until the site's owner has looked
export async function flagReview(id: number, userId: number, kind: FlagKind) {
  const review = await store.findReview(id);
  if (!review || review.status !== "shown")
    throw new NotFoundError("That review is gone.");
  if (review.userId === userId)
    throw new AppError("That's your own review.", 400);
  const flags = await store.addFlag(id, userId, kind);
  if (kind === "report" && reportedEnough(flags)) await store.hideReview(id);
}

// A volume's rating and the reviews anyone may be shown, for what search
// engines read (the volume's summary) and the page's own markup. Never a
// spoiler: a search result would show it to someone who hasn't read it
export async function publicReviews(isbn13: string) {
  const stored = await store.reviewsOfVolume(isbn13, null);
  const withWords = stored
    .filter((review) => review.body)
    .map((review) => sent(review, null))
    .filter((review) => !review.spoiler);
  return {
    ...ratingSummary(stored.map((review) => review.rating)),
    shown: withWords.slice(0, 10).map(({ rating, text, by, writtenAt }) => ({
      rating,
      text,
      by,
      writtenAt,
    })),
  };
}

// For a series on a reader's shelf (its details page): the volumes they
// could rate next, and the reviews they've written of it.
//   toRate   read or owned and not yet rated. The ones they've read up to
//            come first, latest first (that's the one fresh in mind); then
//            ones they own past that. A few, since the page asks one at a time
//   written  theirs, latest volume first, each with its volume's number
// Both empty for a series that isn't theirs
export async function shelfReviews(userId: number, mangaId: number) {
  const manga = await prisma.manga.findFirst({
    where: { id: mangaId, userId },
  });
  if (!manga) return { toRate: [], written: [] };
  const [series] = await shelfSeries([manga]);
  const theirs = (series?.volumes ?? [])
    .filter(
      (volume) =>
        volume.isbn13 &&
        volume.volume !== null &&
        Number.isInteger(volume.volume) &&
        volume.volume >= 1 &&
        hasRead(manga, volume.volume),
    )
    .map((volume) => ({
      isbn13: volume.isbn13!.trim(),
      volume: volume.volume!,
    }));
  const stored = await store.reviewsBy(
    userId,
    theirs.map((volume) => volume.isbn13),
  );
  const reviewOf = new Map(
    stored.map((review) => [review.isbn13.trim(), review]),
  );
  const latestFirst = (one: { volume: number }, other: { volume: number }) =>
    other.volume - one.volume;

  const readUpTo = manga.status ? Infinity : (manga.readVolume ?? 0);
  const unrated = theirs.filter((volume) => !reviewOf.has(volume.isbn13));
  const toRate = [
    ...unrated.filter((volume) => volume.volume <= readUpTo).sort(latestFirst),
    ...unrated.filter((volume) => volume.volume > readUpTo).sort(latestFirst),
  ].slice(0, 3);

  const written = theirs
    .filter((volume) => reviewOf.has(volume.isbn13))
    .sort(latestFirst)
    .map((volume) => ({
      ...volume,
      review: sent(reviewOf.get(volume.isbn13)!, userId),
    }));
  return { toRate, written };
}

// a series' ratings added up, and each reviewed volume's own, by number
export async function seriesReviews(seriesSlug: string) {
  const ratings = await store.ratingsOfSeries(seriesSlug);
  const byVolume = new Map<string, typeof ratings>();
  for (const rating of ratings) {
    const isbn13 = rating.isbn13.trim();
    byVolume.set(isbn13, [...(byVolume.get(isbn13) ?? []), rating]);
  }
  const volumes = [...byVolume].map(([isbn13, ofVolume]) => ({
    isbn13,
    volume: ofVolume[0]!.volume,
    ...ratingSummary(ofVolume.map((one) => one.rating)),
    // how many of them have words to read
    written: ofVolume.filter((one) => one.body).length,
  }));
  volumes.sort((one, other) => (one.volume ?? 0) - (other.volume ?? 0));
  return {
    ...ratingSummary(ratings.map((one) => one.rating)),
    volumes,
  };
}

// ---------- the site owner's list ----------

export async function reviewsToCheck() {
  const reported = await store.reportedReviews();
  // each volume's own name, to say what a review is of
  const books = await prisma.book.findMany({
    where: { isbn13: { in: reported.map((review) => review.isbn13) } },
    select: { isbn13: true, title: true },
  });
  const titleOf = new Map(
    books.map((book) => [book.isbn13.trim(), book.title]),
  );
  return reported.map((review) => ({
    id: review.id,
    isbn13: review.isbn13.trim(),
    title: titleOf.get(review.isbn13.trim()) ?? null,
    rating: review.rating,
    text: review.body,
    by: review.user.displayName || defaultReaderName(review.user.id),
    writtenAt: review.createdAt,
    reports: review._count.flags,
    hidden: review.status !== "shown",
  }));
}

// keep it (its reports are cleared, it shows again) or remove it for good
export async function decideReview(id: number, keep: boolean) {
  if (!(await store.findReview(id)))
    throw new NotFoundError("That review is gone.");
  if (keep) await store.keepReview(id);
  else await store.removeReview(id);
}
