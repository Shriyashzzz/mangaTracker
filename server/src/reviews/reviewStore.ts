// Readers' reviews in the database (volume_reviews, review_flags): reading a
// volume's, writing one's own, flagging someone else's, and the site owner's
// list of reported ones. The rules themselves are in reviewRules.ts.
import { prisma } from "../config/prisma.js";
import type { FlagKind } from "./reviewRules.js";

const HOUR_MS = 60 * 60_000;

// a review with who wrote it, and how many readers have called it a spoiler
const WITH_WRITER = {
  user: { select: { id: true, displayName: true, avatar: true } },
  _count: { select: { flags: { where: { kind: "spoiler" } } } },
} as const;

// a volume's reviews that readers can see, newest first. `alsoBy`: that
// reader's own is included even while it's hidden
export const reviewsOfVolume = (isbn13: string, alsoBy: number | null) =>
  prisma.volumeReview.findMany({
    where: {
      isbn13,
      OR: [{ status: "shown" }, ...(alsoBy ? [{ userId: alsoBy }] : [])],
    },
    orderBy: { createdAt: "desc" },
    take: 200,
    include: WITH_WRITER,
  });

// every shown rating of a series' books, with the volume it's for. One of
// a volume with no book yet isn't among them: it has no page to show on
export async function ratingsOfSeries(seriesSlug: string) {
  const rows = await prisma.volumeReview.findMany({
    where: { seriesSlug, status: "shown", isbn13: { not: null } },
    select: { isbn13: true, volume: true, rating: true, body: true },
  });
  return rows.map((row) => ({ ...row, isbn13: row.isbn13! }));
}

// how many other volumes a reader has written words about in the last
// hour. `otherThanId`: the review being changed, which doesn't count (null
// for a new one). A rating with no words isn't counted: that's one tap,
// and a reader with a full shelf gives a lot of them in a row
export const writtenLately = (
  userId: number,
  otherThanId: number | null,
  now = new Date(),
) =>
  prisma.volumeReview.count({
    where: {
      userId,
      ...(otherThanId === null ? {} : { id: { not: otherThanId } }),
      body: { not: "" },
      updatedAt: { gt: new Date(now.getTime() - HOUR_MS) },
    },
  });

// a reader's own review of a book, hidden or not
export const ownReview = (userId: number, isbn13: string) =>
  prisma.volumeReview.findUnique({
    where: { userId_isbn13: { userId, isbn13 } },
  });

// A reader's own reviews of a series, hidden ones included: the ones of
// these books, and the ones of its volumes we have no book for
export const reviewsOfSeriesBy = (
  userId: number,
  seriesSlug: string,
  isbns: string[],
) =>
  prisma.volumeReview.findMany({
    where: {
      userId,
      OR: [{ isbn13: { in: isbns } }, { seriesSlug, isbn13: null }],
    },
    include: WITH_WRITER,
  });

export type ReviewToSave = {
  userId: number;
  isbn13: string;
  seriesSlug: string;
  volume: number | null;
  rating: number;
  body: string;
  spoiler: boolean;
};

// a reader's review of a volume: written, or written over
export function saveReview(review: ReviewToSave) {
  const { userId, isbn13, ...rest } = review;
  return prisma.volumeReview.upsert({
    where: { userId_isbn13: { userId, isbn13 } },
    create: review,
    update: { ...rest, updatedAt: new Date() },
    include: WITH_WRITER,
  });
}

export const deleteOwnReview = (userId: number, isbn13: string) =>
  prisma.volumeReview.deleteMany({ where: { userId, isbn13 } });

// ---------- a volume we have no book for ----------
// Kept by its series and number, with no ISBN. A reader has one of each;
// the database can't hold them to that (a unique index doesn't count empty
// ISBNs as equal), so it's looked for before it's written.

export type NoBookReview = Omit<ReviewToSave, "isbn13" | "volume"> & {
  volume: number;
};

const noBookOf = (userId: number, seriesSlug: string, volume: number) =>
  prisma.volumeReview.findFirst({
    where: { userId, seriesSlug, volume, isbn13: null },
  });

export async function saveNoBookReview(review: NoBookReview) {
  const { userId, seriesSlug, volume, ...words } = review;
  const has = await noBookOf(userId, seriesSlug, volume);
  return has
    ? prisma.volumeReview.update({
        where: { id: has.id },
        data: { ...words, updatedAt: new Date() },
        include: WITH_WRITER,
      })
    : prisma.volumeReview.create({ data: review, include: WITH_WRITER });
}

export const deleteNoBookReview = (
  userId: number,
  seriesSlug: string,
  volume: number,
) =>
  prisma.volumeReview.deleteMany({
    where: { userId, seriesSlug, volume, isbn13: null },
  });

// the volume numbers of a series that have a review with no book
export async function volumesWithoutABook(seriesSlug: string) {
  const rows = await prisma.volumeReview.findMany({
    where: { seriesSlug, isbn13: null, volume: { not: null } },
    select: { volume: true },
    distinct: ["volume"],
  });
  return rows.map((row) => row.volume!);
}

// A book has turned up for a volume: every reader's review of that volume
// is now of that book, and shows on its page. A reader who has since
// reviewed the book itself keeps that one; their older one is left as it is
export const attachBook = (
  seriesSlug: string,
  volume: number,
  isbn13: string,
) =>
  prisma.$executeRaw`
    UPDATE volume_reviews AS waiting SET isbn13 = ${isbn13}
    WHERE waiting.series_slug = ${seriesSlug}
      AND waiting.volume = ${volume}
      AND waiting.isbn13 IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM volume_reviews AS theirs
        WHERE theirs.user_id = waiting.user_id AND theirs.isbn13 = ${isbn13}
      )
  `;

export const findReview = (id: number) =>
  prisma.volumeReview.findUnique({ where: { id } });

// one reader's flag on a review, once for each kind. How many of that kind
// the review has now
export async function addFlag(
  reviewId: number,
  userId: number,
  kind: FlagKind,
) {
  await prisma.reviewFlag.upsert({
    where: { reviewId_userId_kind: { reviewId, userId, kind } },
    create: { reviewId, userId, kind },
    update: {},
  });
  return prisma.reviewFlag.count({ where: { reviewId, kind } });
}

export const hideReview = (id: number) =>
  prisma.volumeReview.update({ where: { id }, data: { status: "hidden" } });

// for the site's owner: every review with a report, the hidden ones first,
// then the most reported
export async function reportedReviews() {
  const rows = await prisma.volumeReview.findMany({
    where: { flags: { some: { kind: "report" } } },
    include: {
      user: WITH_WRITER.user,
      _count: { select: { flags: { where: { kind: "report" } } } },
    },
    take: 200,
  });
  return rows.sort(
    (one, other) =>
      Number(other.status === "hidden") - Number(one.status === "hidden") ||
      other._count.flags - one._count.flags,
  );
}

// the owner keeps it: its reports are cleared and it shows again
export async function keepReview(id: number) {
  await prisma.reviewFlag.deleteMany({
    where: { reviewId: id, kind: "report" },
  });
  return prisma.volumeReview.update({
    where: { id },
    data: { status: "shown" },
  });
}

// the owner removes it, for good
export const removeReview = (id: number) =>
  prisma.volumeReview.delete({ where: { id } });
