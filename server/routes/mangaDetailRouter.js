import { Router } from "express";
import mangaDetailController from "../controller/mangaDetailController.js";
import mangaHomeController from "../controller/mangaHomeController.js";

export const mangaDetailRouter = Router({ mergeParams: true });

mangaDetailRouter.get("/", mangaDetailController.getMangaDetailController);

mangaDetailRouter.patch("/status", mangaDetailController.changeMangaStatus);

mangaDetailRouter.delete("/", mangaDetailController.deleteManga);
