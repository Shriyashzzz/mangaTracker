import { Router } from "express";
import mangaAddController from "../controller/mangaAddController.js";

export const mangaAddRouter = Router({ mergeParams: true });

mangaAddRouter.post("/", mangaAddController.addMangaController);
