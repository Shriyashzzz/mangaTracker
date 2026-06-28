import { Router } from "express";
import mangaUpdateController from "../controller/mangaUpdateController.js";
import { requireAuth } from "../controller/check_auth.js";
export const mangaUpdateRouter = Router({ mergeParams: true });

mangaUpdateRouter.post("/", requireAuth, mangaUpdateController.updateData);
