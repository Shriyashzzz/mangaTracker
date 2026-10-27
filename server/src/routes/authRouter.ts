// /api/auth/*  and  /api/prefs
import { Router } from "express";
import auth from "../controllers/authController.js";
import { requireSignIn } from "../middlewares/auth.js";

export const authRouter = Router();
authRouter.post("/login", auth.login);
authRouter.post("/signup", auth.signup);
authRouter.post("/logout", auth.logout);
authRouter.get("/me", auth.me);

export const prefsRouter = Router();
prefsRouter.use(requireSignIn);
prefsRouter.get("/", auth.getPrefs);
prefsRouter.put("/", auth.updatePrefs);
