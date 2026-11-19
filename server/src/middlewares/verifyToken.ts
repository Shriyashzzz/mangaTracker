import { validationResult, matchedData, param } from "express-validator";
import { getUserWithToken } from "../models/userQueries.js";
import type { Request, Response, NextFunction } from "express";

const verifyResetPasswordToken = [
  param("resetToken").notEmpty().withMessage("Invalid Token"),
  async (req: Request, res: Response, next: NextFunction) => {
    const validationError = validationResult(req);
    if (!validationError.isEmpty())
      return res
        .status(400)
        .json({ message: "Token param is empty, invalid route" });
    const { resetToken } = matchedData(req);
    const user = await getUserWithToken(resetToken); //get's the correspoing token to the user's row in the user table
    // no account has this token (never sent, or used up), or it ran out of
    // time: one answer for all of them, 410 Gone, which the page reads
    if (
      !user ||
      !user.reset_token_expiry ||
      user.reset_token_expiry < Date.now()
    )
      return res.status(410).json({
        error: [{ msg: "This reset link has run out or was already used." }],
      });
    res.locals.resetUserId = user.id;
    return next();
  },
];

export { verifyResetPasswordToken };
