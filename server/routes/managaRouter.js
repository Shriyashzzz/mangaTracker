import { Router } from "express";
import mangaHomeController from "../controller/mangaHomeController.js";
export const mangaHomeRouter = Router();

mangaHomeRouter.get("/", mangaHomeController.getAllManga);

export default { mangaHomeRouter };
