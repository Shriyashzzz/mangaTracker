// /api/manga/*  the signed-in user's shelf
import { Router } from "express";
import manga from "../controllers/mangaController.js";
import { requireOwner, requireSignIn } from "../middlewares/auth.js";
import { rateLimit } from "../middlewares/rateLimit.js";

export const mangaRouter = Router();
mangaRouter.use(requireSignIn);

mangaRouter.get("/", manga.list);
mangaRouter.post("/", manga.add);
mangaRouter.post("/restore", manga.restore);
// the shelf's Select: delete several, and their undo
mangaRouter.post(
  "/delete-many",
  rateLimit({ max: 20, windowMs: 60_000 }),
  manga.removeMany,
);
// pieces of 200: room for a big shelf's undo in one go
mangaRouter.post(
  "/restore-many",
  rateLimit({ max: 60, windowMs: 60_000 }),
  manga.restoreMany,
);
mangaRouter.post("/import", rateLimit({ max: 60, windowMs: 60_000 }), manga.importList);
// the book import's matches, shared by everyone's imports
mangaRouter.post(
  "/import/matches",
  rateLimit({ max: 30, windowMs: 60_000 }),
  manga.knownImportMatches,
);
mangaRouter.post(
  "/import/matches/found",
  rateLimit({ max: 30, windowMs: 60_000 }),
  manga.tellImportMatches,
);
// these come before "/:id" so their names aren't read as an id
mangaRouter.get("/prices", manga.shelfPrices);
mangaRouter.get("/match", manga.match);

// requireOwner: the manga exists and belongs to whoever is signed in
mangaRouter.get("/:id", requireOwner, manga.detail);
mangaRouter.get("/:id/releases", requireOwner, manga.releases);
mangaRouter.put("/:id", requireOwner, manga.update);
mangaRouter.delete("/:id", requireOwner, manga.remove);
mangaRouter.patch("/:id/status", requireOwner, manga.setStatus);
mangaRouter.patch("/:id/planned", requireOwner, manga.setPlanned);
mangaRouter.patch("/:id/rating", requireOwner, manga.setRating);
mangaRouter.patch("/:id/bookmark", requireOwner, manga.setBookmark);
mangaRouter.patch("/:id/seen", requireOwner, manga.setSeen);
mangaRouter.patch("/:id/notes", requireOwner, manga.setNotes);
mangaRouter.put("/:id/owned", requireOwner, manga.setOwned);
