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

// every shown rating of a series, with the volume it's for
export const ratingsOfSeries = (seriesSlug: string) =>
  prisma.volumeReview.findMany({
    where: { seriesSlug, status: "shown" },
    select: { isbn13: true, volume: true, rating: true, body: true },
  });

// how many other volumes a reader has reviewed in the last hour
export const writtenLately = (
  userId: number,
  otherThan: string,
  now = new Date(),
) =>
  prisma.volumeReview.count({
    where: {
      userId,
      isbn13: { not: otherThan },
      updatedAt: { gt: new Date(now.getTime() - HOUR_MS) },
    },
  });

// a reader's own reviews of these volumes, hidden ones included
export const reviewsBy = (userId: number, isbns: string[]) =>
  prisma.volumeReview.findMany({
    where: { userId, isbn13: { in: isbns } },
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
