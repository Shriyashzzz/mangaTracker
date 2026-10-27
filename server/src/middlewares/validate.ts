import type { NextFunction, Request, Response } from "express";
import { validationResult } from "express-validator";

// ends the request with 400 and every validation message when a rule failed
export function rejectInvalid(req: Request, res: Response, next: NextFunction) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ error: errors.array() });
    return;
  }
  next();
}
