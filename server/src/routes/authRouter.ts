// /api/auth/*  and  /api/prefs
import { Router } from "express";
import { isProd } from "../config/config.js";
import auth from "../controllers/authController.js";
import { requireSignIn } from "../middlewares/auth.js";
import { rateLimit } from "../middlewares/rateLimit.js";

// Enough for typos and a forgotten password, not for guessing one. Off the
// live site (ENV isn't PROD) it's far higher: UI checks run by script sign
// in again on every run, and ten in five minutes made them queue
const SIGN_INS = isProd ? 10 : 200;
const signInLimit = rateLimit({ max: SIGN_INS, windowMs: 5 * 60_000 });
const signUpLimit = rateLimit({ max: 5, windowMs: 60 * 60_000 });

export const authRouter = Router();
authRouter.post("/login", signInLimit, auth.login);
authRouter.post("/signup", signUpLimit, auth.signup);
authRouter.post("/logout", auth.logout);
authRouter.get("/me", auth.me);

export const prefsRouter = Router();
prefsRouter.use(requireSignIn);
prefsRouter.get("/", auth.getPrefs);
prefsRouter.put("/", auth.updatePrefs);
