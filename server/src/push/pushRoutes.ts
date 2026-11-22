// /api/push: the key a device needs to switch alerts on, and switching them
// on and off for one device (its push service's address)
import { Router, type Request, type Response } from "express";
import { body, matchedData } from "express-validator";
import config from "../config/config.js";
import { prisma } from "../config/prisma.js";
import { requireSignIn } from "../middlewares/auth.js";
import { rateLimit } from "../middlewares/rateLimit.js";
import { sendError } from "../middlewares/errorHandler.js";
import { rejectInvalid } from "../middlewares/validate.js";
import { isExpoToken } from "./expoPush.js";
import { pushKeysSet } from "./pushSender.js";
import { isPushService } from "./pushRules.js";

export const pushRouter = Router();

// the public half of the key pair: none means alerts aren't set up here,
// and the page doesn't offer them
pushRouter.get("/key", (_req: Request, res: Response) => {
  if (!pushKeysSet()) return void sendError(res, 404, "No alerts here.");
  res.json({ publicKey: config.VAPID_PUBLIC_KEY });
});

const device = [
  body("endpoint")
    .isString()
    .isLength({ max: 1000 })
    // only the browsers' own push services (pushRules.ts)
    .custom((endpoint: string) => isPushService(endpoint))
    .withMessage("That isn't a push service's address."),
];

// this device, on: saved for the signed-in reader (a device that was
// another reader's on this browser becomes theirs)
pushRouter.post(
  "/subscribe",
  requireSignIn,
  rateLimit({ max: 30, windowMs: 60 * 60_000 }),
  ...device,
  body("keys.p256dh").isString().isLength({ min: 20, max: 200 }),
  body("keys.auth").isString().isLength({ min: 8, max: 100 }),
  rejectInvalid,
  async (req: Request, res: Response) => {
    const d = matchedData(req) as {
      endpoint: string;
      keys: { p256dh: string; auth: string };
    };
    const data = {
      userId: req.session.userId!,
      p256dh: d.keys.p256dh,
      auth: d.keys.auth,
    };
    await prisma.pushSubscription.upsert({
      where: { endpoint: d.endpoint },
      create: { endpoint: d.endpoint, ...data },
      update: data,
    });
    res.sendStatus(204);
  },
);

// this device, off: only ever their own
pushRouter.post(
  "/unsubscribe",
  requireSignIn,
  ...device,
  rejectInvalid,
  async (req: Request, res: Response) => {
    const { endpoint } = matchedData(req) as { endpoint: string };
    await prisma.pushSubscription.deleteMany({
      where: { endpoint, userId: req.session.userId! },
    });
    res.sendStatus(204);
  },
);

// ---------- the phone app ----------
// its Expo push token, kept as a device like a browser's address
const phone = [
  body("token")
    .isString()
    .custom((token: string) => isExpoToken(token))
    .withMessage("That isn't a phone's push token."),
];

// this phone, on: saved for the signed-in reader (a phone that was another
// reader's becomes theirs)
pushRouter.post(
  "/device",
  requireSignIn,
  rateLimit({ max: 30, windowMs: 60 * 60_000 }),
  ...phone,
  rejectInvalid,
  async (req: Request, res: Response) => {
    const { token } = matchedData(req) as { token: string };
    const data = { userId: req.session.userId!, p256dh: "", auth: "" };
    await prisma.pushSubscription.upsert({
      where: { endpoint: token },
      create: { endpoint: token, ...data },
      update: data,
    });
    res.sendStatus(204);
  },
);

// this phone, off (the switch, or signing out): only ever their own
pushRouter.post(
  "/device/forget",
  requireSignIn,
  ...phone,
  rejectInvalid,
  async (req: Request, res: Response) => {
    const { token } = matchedData(req) as { token: string };
    await prisma.pushSubscription.deleteMany({
      where: { endpoint: token, userId: req.session.userId! },
    });
    res.sendStatus(204);
  },
);
