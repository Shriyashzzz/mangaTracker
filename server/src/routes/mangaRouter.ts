// /api/manga/*  the signed-in user's shelf
import { Router } from "express";
import manga from "../controllers/mangaController.js";
import { requireOwner, requireSignIn } from "../middlewares/auth.js";

export const mangaRouter = Router();
mangaRouter.use(requireSignIn);

mangaRouter.get("/", manga.list);
mangaRouter.post("/", manga.add);
// these come before "/:id" so their names aren't read as an id
mangaRouter.get("/prices", manga.shelfPrices);
mangaRouter.get("/match", manga.match);

// requireOwner: the manga exists and belongs to whoever is signed in
mangaRouter.get("/:id", requireOwner, manga.detail);
mangaRouter.put("/:id", requireOwner, manga.update);
mangaRouter.delete("/:id", requireOwner, manga.remove);
mangaRouter.patch("/:id/status", requireOwner, manga.setStatus);
mangaRouter.patch("/:id/rating", requireOwner, manga.setRating);
mangaRouter.put("/:id/owned", requireOwner, manga.setOwned);
