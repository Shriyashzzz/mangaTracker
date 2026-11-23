// /api/auth/*  and  /api/prefs
import { Router } from "express";
import { isProd } from "../config/config.js";
import auth from "../controllers/authController.js";
import { requireSignIn } from "../middlewares/auth.js";
import { rateLimit } from "../middlewares/rateLimit.js";
import { verifyResetPasswordToken } from "../middlewares/verifyToken.js";
import type { Response, Request } from "express";

// Enough for typos and a forgotten password, not for guessing one. Off the
// live site (ENV isn't PROD) it's far higher: UI checks run by script sign
// in again on every run, and ten in five minutes made them queue
const SIGN_INS = isProd ? 10 : 200;
const signInLimit = rateLimit({ max: SIGN_INS, windowMs: 5 * 60_000 });
// accounts made from one place in an hour; tries that fail (a name taken,
// a short password) don't count, but there's a looser cap on tries too
const signUpAccounts = rateLimit({
  max: 5,
  windowMs: 60 * 60_000,
  counts: (status) => status === 201,
});
const signUpTries = rateLimit({ max: 30, windowMs: 60 * 60_000 });
// Reset emails asked for from one place in an hour: enough for a typo or
// two, not for filling someone's inbox. Off the live site it's far higher,
// for the same reason as sign-ins
const resetEmails = rateLimit({
  max: isProd ? 5 : 200,
  windowMs: 60 * 60_000,
});
// Opening a reset link and choosing the password: counted apart from the
// emails, so a mistyped password or two never locks the link out
const resetLinkTries = rateLimit({
  max: isProd ? 30 : 200,
  windowMs: 60 * 60_000,
});
export const authRouter = Router();
authRouter.post("/login", signInLimit, auth.login);
authRouter.post("/signup", signUpTries, signUpAccounts, auth.signup);
// Google's button: signs in, or makes the account (201), so it's counted as
// both a sign-in and, when it makes one, an account
authRouter.post("/google", signInLimit, signUpAccounts, auth.google);
authRouter.post("/apple", signInLimit, signUpAccounts, auth.apple);
authRouter.post("/logout", auth.logout);
authRouter.get("/me", auth.me);
//*****************reset password**************
authRouter.post(
  "/initiatePassReset",
  resetEmails,
  auth.initiateResetPassword,
  (req: Request, res: Response) => {
    return res.status(200).json({
      message: "If that email has an account, we've sent it a reset link.",
    });
  },
);
authRouter.get(
  "/verifytoken/:resetToken",
  resetLinkTries,
  verifyResetPasswordToken,
  (req: Request, res: Response) => {
    return res.sendStatus(200);
  },
);
authRouter.post(
  "/resetPassword/:resetToken",
  resetLinkTries,
  verifyResetPasswordToken,
  auth.resetPassword,
);
//****************************************** */
export const prefsRouter = Router();
prefsRouter.use(requireSignIn);
prefsRouter.get("/", auth.getPrefs);
prefsRouter.put("/", auth.updatePrefs);
