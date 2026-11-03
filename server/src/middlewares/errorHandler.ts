import type { NextFunction, Request, Response } from "express";
import { AppError } from "../errors/AppError.js";

// every error the API sends has this one shape: { error: [{ msg }] }
export function sendError(res: Response, status: number, msg: string) {
  res.status(status).json({ error: [{ msg }] });
}

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
    sendError(res, err.status, err.message);
    return;
  }
  // a request the body reader refused, like broken JSON or too much at once:
  // the sender's problem, said plainly, not a server fault
  const status = (err as { status?: unknown })?.status;
  if (typeof status === "number" && status >= 400 && status < 500) {
    sendError(
      res,
      status,
      status === 413
        ? "That's too much to send at once. Try a smaller piece."
        : "That request couldn't be read. Try again.",
    );
    return;
  }
  console.error(`${req.method} ${req.originalUrl}:`, err);
  sendError(res, 500, "Server error! Please try again later.");
}
