import { Router } from "express";
import mangaHomeController from "../controller/mangaHomeController.js";
import { requireAuth, requireSignIn } from "../controller/check_auth.js";
export const mangaHomeRouter = Router();

mangaHomeRouter.get("/", mangaHomeController.getAllManga);
mangaHomeRouter.get("/match", requireSignIn, mangaHomeController.matchSeries);
// requireAuth checks the manga belongs to whoever is signed in
mangaHomeRouter.put("/:id/owned", requireAuth, mangaHomeController.setOwned);
mangaHomeRouter.get(
  "/prices",
  requireSignIn,
  mangaHomeController.getShelfPriceTags,
);

export default { mangaHomeRouter };
