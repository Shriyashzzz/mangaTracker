import type { NextFunction, Request, Response } from "express";
import { AppError } from "../errors/AppError.js";

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  // Express only treats a handler with four arguments as an error handler
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction,
) {
  if (err instanceof AppError) {
    if (err.status >= 500) console.error(`${req.method} ${req.originalUrl}:`, err);
    res.status(err.status).json({ error: [{ msg: err.message }] });
    return;
  }
  console.error(`${req.method} ${req.originalUrl}:`, err);
  res
    .status(500)
    .json({ error: [{ msg: "Server error! Please try again later." }] });
}
