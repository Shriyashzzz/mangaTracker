import type { NextFunction, Request, Response } from "express";
import mangaQueries from "../models/mangaQueries.js";

// only lets signed in users through
export function requireSignIn(req: Request, res: Response, next: NextFunction) {
  if (!req.session.userId) {
    res.sendStatus(401);
    return;
  }
  next();
}

// signed in AND the owner of the manga in :id. The manga is left on
// res.locals.manga so handlers don't load it again
export async function requireOwner(
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction,
) {
  const userId = req.session.userId;
  if (!userId) {
    res.sendStatus(401);
    return;
  }
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    res.sendStatus(404);
    return;
  }
  const manga = await mangaQueries.getManga(id);
  if (!manga) {
    res.sendStatus(404);
    return;
  }
  if (manga.userId !== userId) {
    res.sendStatus(403);
    return;
  }
  res.locals.manga = manga;
  next();
}
