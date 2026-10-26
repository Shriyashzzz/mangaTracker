import { Router } from "express";
import mangaHomeController from "../controller/mangaHomeController.js";
import { requireSignIn } from "../controller/check_auth.js";
export const mangaHomeRouter = Router();

mangaHomeRouter.get("/", mangaHomeController.getAllManga);
mangaHomeRouter.get(
  "/prices",
  requireSignIn,
  mangaHomeController.getShelfPriceTags,
);

export default { mangaHomeRouter };
