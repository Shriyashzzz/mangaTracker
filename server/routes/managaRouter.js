import { Router } from "express";
import mangaHomeController from "../controller/mangaHomeController.js";
export const mangaRouter = Router();

mangaRouter.get("/", mangaHomeController.getAllManga);

export default mangaRouter;
