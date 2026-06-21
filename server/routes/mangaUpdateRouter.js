import { Router } from "express";
import mangaUpdateController from "../controller/mangaUpdateController.js";
export const mangaUpdateRouter = Router({ mergeParams: true });

mangaUpdateRouter.post("/", mangaUpdateController.updateData);
