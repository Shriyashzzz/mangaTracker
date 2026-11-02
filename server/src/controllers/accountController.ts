// The account's own details: profile, optional recovery email, list sharing and
// deleting it all. Plus the public view of a shared list.
import type { Request, Response } from "express";
import { body, matchedData, param } from "express-validator";
import { sendError } from "../middlewares/errorHandler.js";
import { rejectInvalid } from "../middlewares/validate.js";
import userQueries, { type AccountPatch } from "../models/userQueries.js";
import { AVATARS } from "../util/avatars.js";
import { defaultReaderName, READER_NAMES } from "../util/readerNames.js";
import { toSharedShelf } from "../util/sharedShelf.js";

// the name they show as until they pick one, and the ideas to pick from
const withNames = <T>(userId: number, account: T) => ({
  ...account,
  defaultName: defaultReaderName(userId),
  nameIdeas: READER_NAMES,
});

const get = async (req: Request, res: Response) => {
  const account = await userQueries.getAccount(req.session.userId!);
  if (!account) return sendError(res, 404, "No account found.");
  res.json(withNames(req.session.userId!, account));
};

const update = [
  body("displayName")
    .optional({ values: "null" })
    .isString()
    .trim()
    .isLength({ max: 40 })
    .withMessage("Keep your name to 40 characters."),
  body("avatar").optional({ values: "null" }).isIn(AVATARS),
  body("recoveryEmail")
    .optional({ values: "null" })
    .isString()
    .trim()
    .isLength({ max: 254 })
    .isEmail()
    .withMessage("That doesn't look like an email address."),
  body("shareEnabled").optional().isBoolean({ strict: true }),
  body("shareNotes").optional().isBoolean({ strict: true }),
  rejectInvalid,
  async (req: Request, res: Response) => {
    const data = matchedData(req, { includeOptionals: false }) as AccountPatch;
    // null clears a field, and validation leaves those out
    for (const key of ["displayName", "avatar", "recoveryEmail"] as const) {
      if (req.body?.[key] === null) data[key] = null;
    }
    if (Object.keys(data).length === 0) {
      return sendError(res, 400, "Nothing to save.");
    }
    // a blank name is no name
    if (data.displayName === "") data.displayName = null;
    res.json(
      withNames(
        req.session.userId!,
        await userQueries.updateAccount(req.session.userId!, data),
      ),
    );
  },
];

const remove = [
  body("password").isString().notEmpty().withMessage("Enter your password."),
  rejectInvalid,
  async (req: Request, res: Response) => {
    const { password } = matchedData(req);
    const deleted = await userQueries.deleteAccount(req.session.userId!, password);
    if (!deleted) return sendError(res, 401, "That password isn't right.");
    req.session.destroy(() => res.sendStatus(204));
  },
];

const shared = [
  param("code").matches(/^[\w-]{4,16}$/),
  rejectInvalid,
  async (req: Request, res: Response) => {
    const user = await userQueries.getSharedShelf(matchedData(req).code);
    if (!user) return sendError(res, 404, "This shelf isn't shared.");
    res.json(toSharedShelf(user));
  },
];

export default { get, update, remove, shared };
