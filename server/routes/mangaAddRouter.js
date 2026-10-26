import { Router } from "express";
import mangaAddController from "../controller/mangaAddController.js";
import { requireSignIn } from "../controller/check_auth.js";

export const mangaAddRouter = Router({ mergeParams: true });

mangaAddRouter.post("/", requireSignIn, mangaAddController.addMangaController);
