import type { NextFunction, Request, Response } from "express";
import { validationResult } from "express-validator";

// an id the database can hold: its whole numbers stop at 2,147,483,647, and a
// bigger one asked for ("/details/999999999999") failed as a 500
export const ROW_ID = { min: 1, max: 2_147_483_647 };

// ends the request with 400 when a rule failed: one message per field, the
// first rule it broke (an empty username shouldn't also be told it's too
// short and has invalid characters)
export function rejectInvalid(req: Request, res: Response, next: NextFunction) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    // what was typed is never sent back: a password in an error is a
    // password in a log
    const sent = errors.array({ onlyFirstError: true }).map((error) => {
      const copy: Record<string, unknown> = { ...error };
      delete copy.value;
      return copy;
    });
    res.status(400).json({ error: sent });
    return;
  }
  next();
}
