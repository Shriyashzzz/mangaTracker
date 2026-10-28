import type { NextFunction, Request, Response } from "express";
import mangaQueries from "../models/mangaQueries.js";
import { sendError } from "./errorHandler.js";

const SIGN_IN = "Please sign in first.";
const NO_MANGA = "We couldn't find that manga.";

// only lets signed in users through
export function requireSignIn(req: Request, res: Response, next: NextFunction) {
  if (!req.session.userId) {
    sendError(res, 401, SIGN_IN);
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
    sendError(res, 401, SIGN_IN);
    return;
  }
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    sendError(res, 404, NO_MANGA);
    return;
  }
  const manga = await mangaQueries.getManga(id);
  if (!manga) {
    sendError(res, 404, NO_MANGA);
    return;
  }
  if (manga.userId !== userId) {
    sendError(res, 403, "That manga is on someone else's shelf.");
    return;
  }
  res.locals.manga = manga;
  next();
}
