// /api/auth/*  and  /api/prefs
import { Router } from "express";
import auth from "../controllers/authController.js";
import { requireSignIn } from "../middlewares/auth.js";
import { rateLimit } from "../middlewares/rateLimit.js";

// enough for typos and a forgotten password, not for guessing one
const signInLimit = rateLimit({ max: 10, windowMs: 5 * 60_000 });
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
