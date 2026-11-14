import type { NextFunction, Request, Response } from "express";
import config from "../config/config.js";
import userQueries from "../models/userQueries.js";
import { sendError } from "./errorHandler.js";

// only the site's owner: the account named in ADMIN_USERNAME. Anyone else
// is told there's nothing here. For the owner's review pages (readers'
// anime fixes, reported reviews)
export async function requireOwnerOfSite(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const userId = req.session.userId;
  const account = userId ? await userQueries.getAccount(userId) : null;
  const isOwner =
    Boolean(config.ADMIN_USERNAME) &&
    account?.username === config.ADMIN_USERNAME;
  if (!isOwner) return void sendError(res, 404, "Not found");
  next();
}
