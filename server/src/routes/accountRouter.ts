// /api/account  and  /api/share
import { Router } from "express";
import account from "../controllers/accountController.js";
import { requireSignIn } from "../middlewares/auth.js";
import { rateLimit } from "../middlewares/rateLimit.js";

export const accountRouter = Router();
accountRouter.use(requireSignIn);
accountRouter.get("/", account.get);
accountRouter.patch("/", account.update);
// checks a password, so not as many tries as anything else
accountRouter.delete("/", rateLimit({ max: 10, windowMs: 60_000 }), account.remove);

// public: anyone with the link
export const shareRouter = Router();
shareRouter.get("/:code", rateLimit({ max: 60, windowMs: 60_000 }), account.shared);
