import { Router } from "express";
import mangaDetailController from "../controller/mangaDetailController.js";
import mangaHomeController from "../controller/mangaHomeController.js";
import { requireAuth } from "../controller/check_auth.js";

export const mangaDetailRouter = Router({ mergeParams: true });

mangaDetailRouter.get(
  "/",
  requireAuth,
  mangaDetailController.getMangaDetailController,
);

mangaDetailRouter.patch(
  "/status",
  requireAuth,
  mangaDetailController.changeMangaStatus,
);

mangaDetailRouter.delete("/", requireAuth, mangaDetailController.deleteManga);

mangaDetailRouter.patch(
  "/rating",
  requireAuth,
  mangaDetailController.patchMangaRating,
);

//write a middleware that checks if the userid is populated and the requested manga's userid fk matches with session.userId
//if not do not give access to the data
