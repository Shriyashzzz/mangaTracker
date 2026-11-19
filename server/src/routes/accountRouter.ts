// /api/account,  /api/share  and  /api/email
import { Router } from "express";
import account from "../controllers/accountController.js";
import { requireSignIn } from "../middlewares/auth.js";
import { rateLimit } from "../middlewares/rateLimit.js";
import { isProd } from "../config/config.js";

export const accountRouter = Router();
accountRouter.use(requireSignIn);
accountRouter.get("/", account.get);
accountRouter.patch("/", account.update);
// checks a password, so not as many tries as anything else
accountRouter.delete(
  "/",
  rateLimit({ max: 10, windowMs: 60_000 }),
  account.remove,
);

// the weekly email's switch. Switching it on mails a confirm link, so it's
// counted: enough for a mistyped address or two, not for filling an inbox
accountRouter.post(
  "/weekly-email",
  rateLimit({ max: isProd ? 6 : 200, windowMs: 60 * 60_000 }),
  account.weeklyEmail,
);

// the links in our emails: no sign-in, the code in the link says whose
export const emailRouter = Router();
const emailLinks = rateLimit({ max: isProd ? 30 : 500, windowMs: 60 * 60_000 });
emailRouter.post("/confirm/:code", emailLinks, account.confirmEmail);
emailRouter.post("/unsubscribe/:code", emailLinks, account.unsubscribe);

// public: anyone with the link
export const shareRouter = Router();
shareRouter.get(
  "/:code",
  rateLimit({ max: 60, windowMs: 60_000 }),
  account.shared,
);
