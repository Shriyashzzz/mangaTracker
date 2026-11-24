// Blocking another reader (App Store guideline 1.2: a way to block abusive
// users wherever other readers' words or shelves are shown). A block is one
// reader's own: the blocked reader is never told.
//
//   GET    /api/blocks        the readers you've blocked
//   POST   /api/blocks        { reviewId } or { shareCode }: block its writer
//                            or the shelf's owner
//   DELETE /api/blocks/:id    unblock
//
// What a block does (each place asks here):
//   - the blocked reader's reviews aren't shown to the blocker
//     (reviews/reviews.ts)
//   - neither can follow, or open, the other's shared shelf, and any follow
//     between them ends (friends/friends.ts, accountController shared)
import { Router, type Request, type Response } from "express";
import { body, matchedData, param } from "express-validator";
import { prisma } from "../config/prisma.js";
import { requireSignIn } from "../middlewares/auth.js";
import { rateLimit } from "../middlewares/rateLimit.js";
import { rejectInvalid } from "../middlewares/validate.js";
import { sendError } from "../middlewares/errorHandler.js";
import { readerName } from "../util/shelf/readerNames.js";

// the readers this reader has blocked (whose reviews they don't see)
export async function blockedBy(viewerId: number | null | undefined) {
  if (viewerId == null) return new Set<number>();
  const rows = await prisma.userBlock.findMany({
    where: { blockerId: viewerId },
    select: { blockedId: true },
  });
  return new Set(rows.map((row) => row.blockedId));
}

// whether either of the two has blocked the other (a shared shelf between
// them is closed both ways)
export async function eitherBlocked(
  a: number | null | undefined,
  b: number,
): Promise<boolean> {
  if (a == null || a === b) return false;
  const found = await prisma.userBlock.findFirst({
    where: {
      OR: [
        { blockerId: a, blockedId: b },
        { blockerId: b, blockedId: a },
      ],
    },
    select: { id: true },
  });
  return Boolean(found);
}

// the reader a block is of: a review's writer, or a shared shelf's owner
async function whoIsIt(d: { reviewId?: number; shareCode?: string }) {
  if (d.reviewId != null) {
    const review = await prisma.volumeReview.findUnique({
      where: { id: d.reviewId },
      select: { userId: true },
    });
    return review?.userId ?? null;
  }
  if (d.shareCode) {
    const owner = await prisma.user.findFirst({
      where: { shareCode: d.shareCode },
      select: { id: true },
    });
    return owner?.id ?? null;
  }
  return null;
}

const block = [
  body("reviewId").optional().isInt({ min: 1 }).toInt(),
  body("shareCode")
    .optional()
    .isString()
    .matches(/^[\w-]{4,16}$/),
  rejectInvalid,
  async (req: Request, res: Response) => {
    const d = matchedData(req) as { reviewId?: number; shareCode?: string };
    if (d.reviewId == null && !d.shareCode)
      return sendError(res, 400, "Say which reader to block.");
    const blockedId = await whoIsIt(d);
    if (blockedId == null) return sendError(res, 404, "That reader is gone.");
    const blockerId = req.session.userId!;
    if (blockedId === blockerId) return sendError(res, 400, "That's you.");
    await prisma.$transaction([
      prisma.userBlock.upsert({
        where: { blockerId_blockedId: { blockerId, blockedId } },
        create: { blockerId, blockedId },
        update: {},
      }),
      // any following between them ends, both ways
      prisma.shelfFollow.deleteMany({
        where: {
          OR: [
            { followerId: blockerId, ownerId: blockedId },
            { followerId: blockedId, ownerId: blockerId },
          ],
        },
      }),
    ]);
    res.status(201).json({ blocked: true });
  },
];

const list = async (req: Request, res: Response) => {
  const rows = await prisma.userBlock.findMany({
    where: { blockerId: req.session.userId! },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      blocked: { select: { id: true, displayName: true, avatar: true } },
    },
  });
  res.set("Cache-Control", "private, no-store").json({
    blocks: rows.map((row) => ({
      id: row.id,
      // the name they go by to other readers, never their username
      name: readerName(row.blocked),
      avatar: row.blocked.avatar,
    })),
  });
};

const unblock = [
  param("id").isInt({ min: 1 }).toInt(),
  rejectInvalid,
  async (req: Request, res: Response) => {
    // only one of their own: someone else's block isn't theirs to lift
    await prisma.userBlock.deleteMany({
      where: { id: matchedData(req).id, blockerId: req.session.userId! },
    });
    res.json({ blocked: false });
  },
];

const perMinute = (max: number) => rateLimit({ max, windowMs: 60_000 });

export const blocksRouter = Router();
blocksRouter.use(requireSignIn);
blocksRouter.get("/", perMinute(60), list);
blocksRouter.post("/", perMinute(30), ...block);
blocksRouter.delete("/:id", perMinute(30), ...unblock);
