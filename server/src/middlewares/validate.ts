import type { NextFunction, Request, Response } from "express";
import { validationResult } from "express-validator";

// ends the request with 400 when a rule failed: one message per field, the
// first rule it broke (an empty username shouldn't also be told it's too
// short and has invalid characters)
export function rejectInvalid(req: Request, res: Response, next: NextFunction) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ error: errors.array({ onlyFirstError: true }) });
    return;
  }
  next();
}
