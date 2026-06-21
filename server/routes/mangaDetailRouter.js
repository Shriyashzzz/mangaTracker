import { Router } from "express";
import mangaDetailController from "../controller/mangaDetailController.js";

export const mangaDetailRouter = Router({ mergeParams: true });

mangaDetailRouter.get("/", mangaDetailController.getMangaDetailController);

mangaDetailRouter.put("/status", mangaDetailController.changeMangaStatus);
