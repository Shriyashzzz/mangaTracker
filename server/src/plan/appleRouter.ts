// /api/apple: what Apple's App Store sends us (src/plan/applePurchases.ts)
import { Router, type Request, type Response } from "express";
import { applePurchases } from "./applePurchases.js";

export const appleRouter = Router();

// App Store Server Notifications, version 2: a renewal, an expiry, a
// refund. Signed by Apple and checked before anything changes. Answered
// 200 whatever it was, or Apple sends it again for days
appleRouter.post("/notifications", async (req: Request, res: Response) => {
  const signedPayload = (req.body as { signedPayload?: unknown })
    ?.signedPayload;
  if (typeof signedPayload === "string" && signedPayload.length < 20_000)
    await applePurchases.applyNotification(signedPayload).catch((e) => {
      console.error("App Store notification", e);
    });
  res.sendStatus(200);
});
