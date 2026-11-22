// Friends: following another reader's shared shelf. Sharing it is the
// owner's yes, so there are no requests; a followed shelf whose sharing is
// off since simply isn't listed (and comes back if it's switched on again).
//
//   POST   /api/share/:code/follow   follow it (signed in, not your own)
//   DELETE /api/share/:code/follow   stop
//   GET    /api/friends              the shelves you follow, still shared
import { readerName } from "../util/shelf/readerNames.js";
import { Router, type Request, type Response } from "express";
import { param, matchedData } from "express-validator";
import { prisma } from "../config/prisma.js";
import { requireSignIn } from "../middlewares/auth.js";
import { rateLimit } from "../middlewares/rateLimit.js";
import { rejectInvalid } from "../middlewares/validate.js";
import { sendError } from "../middlewares/errorHandler.js";
import { ownedSet } from "../collector/shelfMath.js";

const codeParam = [param("code").matches(/^[\w-]{4,16}$/), rejectInvalid];

// the shared shelf's owner, by its link's code; null when it isn't shared
const ownerOf = (shareCode: string) =>
  prisma.user.findFirst({
    where: { shareCode, shareEnabled: true },
    select: { id: true },
  });

// whether the viewer follows the shelf with this owner (the shared page asks)
export const follows = async (
  followerId: number | undefined,
  ownerId: number,
) =>
  followerId != null &&
  Boolean(
    await prisma.shelfFollow.findUnique({
      where: { followerId_ownerId: { followerId, ownerId } },
    }),
  );

const follow = [
  ...codeParam,
  async (req: Request, res: Response) => {
    const owner = await ownerOf(matchedData(req).code);
    if (!owner) return sendError(res, 404, "This shelf isn't shared.");
    const followerId = req.session.userId!;
    if (owner.id === followerId)
      return sendError(res, 400, "That's your own shelf.");
    await prisma.shelfFollow.upsert({
      where: { followerId_ownerId: { followerId, ownerId: owner.id } },
      create: { followerId, ownerId: owner.id },
      update: {},
    });
    res.json({ following: true });
  },
];

const unfollow = [
  ...codeParam,
  async (req: Request, res: Response) => {
    // by the code: one switched off since is unfollowed all the same
    await prisma.shelfFollow.deleteMany({
      where: {
        followerId: req.session.userId!,
        owner: { shareCode: matchedData(req).code },
      },
    });
    res.json({ following: false });
  },
];

const list = async (req: Request, res: Response) => {
  const rows = await prisma.shelfFollow.findMany({
    where: { followerId: req.session.userId!, owner: { shareEnabled: true } },
    orderBy: { createdAt: "desc" },
    select: {
      owner: {
        select: {
          id: true,
          displayName: true,
          avatar: true,
          shareCode: true,
          manga: { select: { volumesOwned: true, ownedList: true } },
        },
      },
    },
  });
  res.json({
    friends: rows
      .filter((r) => r.owner.shareCode)
      .map(({ owner }) => ({
        code: owner.shareCode!,
        // the name their shelf goes by: their own, or the one every reader
        // without one is given (readerNames.ts), never a different stand-in
        name: readerName(owner),
        avatar: owner.avatar,
        series: owner.manga.length,
        volumes: owner.manga.reduce((n, m) => n + ownedSet(m).size, 0),
      })),
  });
};

const perMinute = (max: number) => rateLimit({ max, windowMs: 60_000 });

export const followRoutes = Router();
followRoutes.post("/:code/follow", requireSignIn, perMinute(30), ...follow);
followRoutes.delete("/:code/follow", requireSignIn, perMinute(30), ...unfollow);

export const friendsRouter = Router();
friendsRouter.get("/", requireSignIn, perMinute(60), list);
