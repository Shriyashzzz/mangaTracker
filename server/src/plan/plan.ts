// An account's plan as the routes use it: read from the database, with what
// it has used, for the device asking (planRules.ts has the rules).
import type { Request, Response } from "express";
import config from "../config/config.js";
import { prisma } from "../config/prisma.js";
import {
  entitlements,
  FULL,
  hasRoom,
  isLimited,
  limitedPlatforms,
  planOf,
  type Counted,
  type Entitlements,
  type Platform,
} from "./planRules.js";

// The app says what it is in a header (the iPhone app "ios", the Android
// app "android"); anything else is a browser. It decides only where the
// limits are switched on first, so a made-up value gains nothing that the
// website doesn't already give
export const platformOf = (req: Request): Platform => {
  const said = String(req.get("x-app") ?? "").toLowerCase();
  return said === "ios" || said === "android" ? said : "web";
};

export async function planFor(
  userId: number,
  platform: Platform,
): Promise<Entitlements | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { plan: true, planUntil: true, scansUsed: true, mangaCount: true },
  });
  if (!user) return null;
  const plan = planOf(user);
  const limited = isLimited(
    plan,
    platform,
    limitedPlatforms(config.COLLECTOR_LIMITS_ON),
  );
  const priceAlerts = await prisma.toBuy.count({
    where: { userId, alertCents: { not: null } },
  });
  return entitlements(plan, limited, {
    series: user.mangaCount,
    scans: user.scansUsed,
    priceAlerts,
  });
}

// For a route about to add one more of something. True when there's room;
// otherwise it has answered 402 with what to say, and the route stops.
// `code` lets the app open its Collector sheet rather than show an error
export async function roomFor(
  req: Request,
  res: Response,
  what: Counted,
  adding = 1,
) {
  const plan = await planFor(req.session.userId!, platformOf(req));
  if (!plan || hasRoom(plan, what, adding)) return true;
  res
    .status(402)
    .json({ error: [{ msg: FULL[what] }], code: "collector", what });
  return false;
}

// one more barcode scanned
export const countScan = (userId: number) =>
  prisma.user
    .update({ where: { id: userId }, data: { scansUsed: { increment: 1 } } })
    .catch(() => {});
