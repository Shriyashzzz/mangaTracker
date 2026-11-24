// Readers' reviews of a volume, as the pages ask for them: a volume's
// reviews with whether this reader may write one, writing and flagging, and
// a series' ratings added up. The rules are reviewRules.ts; the database is
// reviewStore.ts.
import type { Manga } from "../../generated/prisma/client.js";
import config from "../config/config.js";
import { prisma } from "../config/prisma.js";
import { ownedSet } from "../collector/shelfMath.js";
import { shelfSeries } from "../collector/shelfSeries.js";
import { AppError, NotFoundError } from "../errors/AppError.js";
import mangaQueries from "../models/mangaQueries.js";
import { priceName } from "../prices/lightNovel.js";
import { knownSeriesName } from "../prices/sources/anilist.js";
import { seriesName, slugify } from "../prices/stores/match.js";
import { titleVolume } from "../prices/volumeNames.js";
import { readerName } from "../util/shelf/readerNames.js";
import {
  hasLink,
  hasRead,
  ratingSpread,
  ratingSummary,
  readersSaySpoiler,
  reportedEnough,
  finishedLately,
  latestVolume,
  mayAskAgain,
  REVIEWS_AN_HOUR,
  tidyWords,
  type FlagKind,
} from "./reviewRules.js";
import * as store from "./reviewStore.js";
import { storedVolumeStarts } from "../util/releases/releaseCache.js";
import { volumeOfChapter } from "../util/releases/volumeStarts.js";
import { blockedBy } from "../blocks/blocks.js";

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
  by: readerName(review.user),
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
  const [stored, allowed, blocked] = await Promise.all([
    store.reviewsOfVolume(isbn13, viewerId),
    mayWrite(viewerId, isbn13),
    blockedBy(viewerId),
  ]);
  const shown = stored.filter((review) => review.status === "shown");
  const yours = stored.find((review) => review.userId === viewerId);
  return {
    // every shown rating counts; the list is the ones with words
    ...ratingSummary(shown.map((review) => review.rating)),
    // how many gave 1 star, 2 … 5, for the page's bars
    spread: ratingSpread(shown.map((review) => review.rating)),
    // the words of readers they've blocked aren't shown to them (their stars
    // still count above, as everyone's do)
    reviews: shown
      .filter((review) => review.body && !blocked.has(review.userId))
      .map((review) => sent(review, viewerId)),
    yours: yours ? sent(yours, viewerId) : null,
    mayWrite: allowed,
  };
}

export type NewReview = { rating: number; text: string; spoiler: boolean };

// the series a shelf entry's reviews belong to: as the price pages name it
// (AniList's own name for it, where the shelf has it under another), so a
// series' page finds them
const seriesSlugOf = async (manga: Manga) =>
  slugify(await knownSeriesName(priceName(manga)));

// A review's words as they'll be kept. Refused with a link in them, or when
// this reader has written about too many volumes this hour (`existingId`:
// the review being changed, which doesn't count). Stars alone are never
// held back: they can be given to every volume
async function wordsToKeep(
  userId: number,
  text: string,
  existingId: number | null,
) {
  const body = tidyWords(text);
  if (hasLink(body))
    throw new AppError(
      "Reviews can't have links. Take it out and try again.",
      400,
    );
  const wroteTooMany =
    body !== "" &&
    (await store.writtenLately(userId, existingId)) >= REVIEWS_AN_HOUR;
  if (wroteTooMany)
    throw new AppError("That's a lot of reviews. Try again in an hour.", 429);
  return body;
}

const NOT_READ = "Mark this volume as owned or read on your shelf first.";

// writes a reader's review of a book, or writes over the one they have.
// From the book's own price page
export async function writeReview(
  userId: number,
  isbn13: string,
  { rating, text, spoiler }: NewReview,
) {
  const existing = await store.ownReview(userId, isbn13);
  const body = await wordsToKeep(userId, text, existing?.id ?? null);
  const place = await shelfPlaceOf(userId, isbn13);
  if (!place || !hasRead(place.manga, place.volume))
    throw new AppError(NOT_READ, 403);
  const saved = await store.saveReview({
    userId,
    isbn13,
    seriesSlug: await seriesSlugOf(place.manga),
    volume: place.volume,
    rating,
    body,
    spoiler: spoiler && body !== "",
  });
  return sent(saved, userId);
}

// Writes a reader's review of a volume of a series on their shelf, by its
// number: from the series' page, where a volume is its number. Of the
// book, when we have one for that volume; otherwise it's kept by series
// and number until a book turns up (attachNoBookReviews)
export async function writeShelfReview(
  userId: number,
  mangaId: number,
  volume: number,
  { rating, text, spoiler }: NewReview,
) {
  const manga = await prisma.manga.findFirst({
    where: { id: mangaId, userId },
  });
  if (!manga) throw new NotFoundError("That series isn't on your shelf.");
  const { theirs, reviewOf, seriesSlug } = await theirVolumes(userId, manga);
  const asked = theirs.find((one) => one.volume === volume);
  if (!asked) throw new AppError(NOT_READ, 403);
  const existing = reviewOf.get(volume);
  const body = await wordsToKeep(userId, text, existing?.id ?? null);
  const words = { rating, body, spoiler: spoiler && body !== "" };
  const saved = asked.isbn13
    ? await store.saveReview({
        userId,
        isbn13: asked.isbn13,
        seriesSlug,
        volume,
        ...words,
      })
    : await store.saveNoBookReview({ userId, seriesSlug, volume, ...words });
  return sent(saved, userId);
}

// takes their review of that volume away; nothing happens with none
export async function deleteShelfReview(
  userId: number,
  mangaId: number,
  volume: number,
) {
  const manga = await prisma.manga.findFirst({
    where: { id: mangaId, userId },
  });
  if (!manga) return;
  const { theirs, seriesSlug } = await theirVolumes(userId, manga);
  const isbn13 = theirs.find((one) => one.volume === volume)?.isbn13;
  if (isbn13) await store.deleteOwnReview(userId, isbn13);
  await store.deleteNoBookReview(userId, seriesSlug, volume);
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

// the most volumes a series is counted up to, from the volume they're on
const MOST_VOLUMES = 999;

// The volumes of a series on their shelf that they own or have read: each
// with its book's ISBN (null when we have no book for that volume), their
// review of each one they've reviewed, by volume number, and the series'
// slug. A volume is a whole number from 1
// How far they've read, for which volume to ask about: the volume they keep
// their place by, or for a chapter reader every volume before the one their
// next chapter is in (on chapter 38, in vol. 5: up to vol. 4). 0 when they
// keep no place, or the chapter's volume isn't known
async function readToOf(manga: Manga) {
  if (manga.readVolume) return manga.readVolume;
  if (!manga.bookmark) return 0;
  const starts = await storedVolumeStarts(manga.name);
  const holdsNext = volumeOfChapter(Math.floor(manga.bookmark) + 1, starts);
  return holdsNext ? holdsNext - 1 : 0;
}

async function theirVolumes(userId: number, manga: Manga) {
  const [[series], seriesSlug] = await Promise.all([
    shelfSeries([manga]),
    seriesSlugOf(manga),
  ]);
  const isWhole = (volume: number | null): volume is number =>
    volume !== null && Number.isInteger(volume) && volume >= 1;
  // the book we have for each volume
  const bookOf = new Map<number, string>();
  for (const listed of series?.volumes ?? [])
    if (listed.isbn13 && isWhole(listed.volume))
      bookOf.set(listed.volume, listed.isbn13.trim());
  // books turned up since a review was written without one: it's theirs now
  await attachNoBookReviews(seriesSlug, bookOf);

  // every volume it could be: the ones we list, the ones they own, and
  // the ones up to where they've read
  const readUpTo = Math.min(manga.readVolume ?? 0, MOST_VOLUMES);
  const numbers = new Set<number>([
    ...bookOf.keys(),
    ...[...ownedSet(manga)].filter(isWhole),
    ...Array.from({ length: readUpTo }, (_, at) => at + 1),
  ]);
  const theirs = [...numbers]
    .filter((volume) => hasRead(manga, volume))
    .map((volume) => ({ volume, isbn13: bookOf.get(volume) ?? null }));

  const stored = await store.reviewsOfSeriesBy(
    userId,
    seriesSlug,
    theirs.flatMap((one) => (one.isbn13 ? [one.isbn13] : [])),
  );
  const volumeOf = new Map(
    [...bookOf].map(([volume, isbn13]) => [isbn13, volume]),
  );
  const reviewOf = new Map<number, (typeof stored)[number]>();
  for (const review of stored) {
    const volume = review.isbn13
      ? volumeOf.get(review.isbn13.trim())
      : review.volume;
    // the one of the book comes first when they somehow have both
    if (volume != null && (review.isbn13 || !reviewOf.has(volume)))
      reviewOf.set(volume, review);
  }
  return { theirs, reviewOf, seriesSlug };
}

// A book has turned up for volumes that readers reviewed without one: those
// reviews become that book's, so they show on its price page. `bookOf`:
// the book we have for each volume of the series. Asked for where a
// series' books are known: its price page, and a reader's page for it
export async function attachNoBookReviews(
  seriesSlug: string,
  bookOf: Map<number, string>,
) {
  for (const volume of await store.volumesWithoutABook(seriesSlug)) {
    const isbn13 = bookOf.get(volume);
    if (isbn13) await store.attachBook(seriesSlug, volume, isbn13);
  }
}

// They've just finished a volume (their read volume went up, or they
// marked the series finished). Its page asks out loud what they thought,
// "How was vol. 9?", but only when all of this holds:
//   - they haven't rated it
//   - they haven't been asked in the last RATE_ASK_EVERY_DAYS, about any
//     series: it's meant to come once in a blue moon
// A finish that doesn't get the question doesn't use up their turn. True
// when the page will ask
export async function askAboutFinishedVolume(
  userId: number,
  mangaId: number,
  now = new Date(),
  everyDays = config.RATE_ASK_EVERY_DAYS,
) {
  const [manga, reader] = await Promise.all([
    prisma.manga.findFirst({ where: { id: mangaId, userId } }),
    prisma.user.findUnique({
      where: { id: userId },
      select: { rateAskedAt: true },
    }),
  ]);
  if (!manga || !reader) return false;
  if (!mayAskAgain(reader.rateAskedAt, everyDays, now)) return false;
  const { theirs, reviewOf } = await theirVolumes(userId, manga);
  const { latest, isTheOneRead } = latestVolume(
    { status: manga.status, readVolume: await readToOf(manga) },
    theirs,
  );
  if (!latest || !isTheOneRead || reviewOf.has(latest.volume)) return false;
  await mangaQueries.startAskingAboutVolume(mangaId, userId, now);
  return true;
}

// For a series on a reader's shelf (its details page): the volumes they
// could rate next, and the reviews they've written of it.
//   latest   the last volume they've read (or, for someone who only keeps
//            what they own, the last they own), rated or not: the one the
//            page's stars are about (reviewRules.ts latestVolume)
//   toRate   read or owned and not yet rated. The ones they've read up to
//            come first, latest first (that's the one fresh in mind); then
//            ones they own past that. A few, since the page asks one at a time
//   written  theirs, latest volume first, each with its volume's number
//   justFinished  `latest`, while the page is asking about it out loud:
//            askAboutFinishedVolume started that in the last few days, and
//            it still isn't rated. Else null
// Empty for a series that isn't theirs
export async function shelfReviews(
  userId: number,
  mangaId: number,
  now = new Date(),
) {
  const manga = await prisma.manga.findFirst({
    where: { id: mangaId, userId },
  });
  if (!manga)
    return { latest: null, toRate: [], written: [], justFinished: null };
  const { theirs, reviewOf } = await theirVolumes(userId, manga);
  const latestFirst = (one: { volume: number }, other: { volume: number }) =>
    other.volume - one.volume;

  const readUpTo = manga.status ? Infinity : (manga.readVolume ?? 0);
  const unrated = theirs.filter((volume) => !reviewOf.has(volume.volume));
  const toRate = [
    ...unrated.filter((volume) => volume.volume <= readUpTo).sort(latestFirst),
    ...unrated.filter((volume) => volume.volume > readUpTo).sort(latestFirst),
  ].slice(0, 10);

  const written = theirs
    .filter((volume) => reviewOf.has(volume.volume))
    .sort(latestFirst)
    .map((volume) => ({
      ...volume,
      review: sent(reviewOf.get(volume.volume)!, userId),
    }));
  const { latest, isTheOneRead } = latestVolume(
    { status: manga.status, readVolume: await readToOf(manga) },
    theirs,
  );
  // asked about out loud: it's the volume they finished, that was lately,
  // and they haven't rated it
  const isAsked =
    latest !== null &&
    isTheOneRead &&
    finishedLately(manga.readVolumeAt, now) &&
    !reviewOf.has(latest.volume);
  return { latest, toRate, written, justFinished: isAsked ? latest : null };
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
    where: {
      isbn13: {
        in: reported.flatMap((review) =>
          review.isbn13 ? [review.isbn13] : [],
        ),
      },
    },
    select: { isbn13: true, title: true },
  });
  const titleOf = new Map(
    books.map((book) => [book.isbn13.trim(), book.title]),
  );
  return reported.map((review) => ({
    id: review.id,
    // null for a volume we have no book for
    isbn13: review.isbn13?.trim() ?? null,
    title: review.isbn13 ? (titleOf.get(review.isbn13.trim()) ?? null) : null,
    rating: review.rating,
    text: review.body,
    by: readerName(review.user),
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
