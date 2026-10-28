// Sign in, sign up, sign out, "am I signed in?" and display preferences.
// Sessions live in Postgres (connect-pg-simple); the cookie only holds its id.
import type { Request, Response } from "express";
import { body, matchedData } from "express-validator";
import { rejectInvalid } from "../middlewares/validate.js";
import { sendError } from "../middlewares/errorHandler.js";
import userQueries, { type Prefs } from "../models/userQueries.js";

const credentials = [
  body("username")
    .trim()
    .notEmpty()
    .withMessage("I need your name to let you in, come on you know that!")
    .isAlphanumeric()
    .withMessage("Usernames are letters and numbers only")
    .isLength({ min: 4, max: 40 })
    .withMessage("Username has to be between 4 to 40 characters long <3"),
  body("password")
    .notEmpty()
    .withMessage("Alright, don't forget your secret code. Spill the beans now!")
    .isLength({ min: 5 })
    .withMessage("Password has to be at least 5 characters long!"),
];

// a fresh session id on every sign in, so an old cookie can't be reused
const startSession = (req: Request, userId: number) =>
  new Promise<void>((resolve, reject) =>
    req.session.regenerate((err) => {
      if (err) return reject(err);
      req.session.userId = userId;
      resolve();
    }),
  );

const login = [
  ...credentials,
  rejectInvalid,
  async (req: Request, res: Response) => {
    const { username, password } = matchedData(req);
    const result = await userQueries.checkCredentials(username, password);
    if ("status" in result) {
      res.status(result.status).json({
        error: [
          {
            msg:
              result.status === 401
                ? "Incorrect password"
                : "No account with that username",
          },
        ],
      });
      return;
    }
    await startSession(req, result.userId);
    res.sendStatus(200);
  },
];

const signup = [
  ...credentials,
  rejectInvalid,
  async (req: Request, res: Response) => {
    const { username, password } = matchedData(req);
    const userId = await userQueries.addUser(username, password);
    if (userId === null) {
      res
        .status(409)
        .json({ error: [{ msg: "That username is taken, try another <3" }] });
      return;
    }
    await startSession(req, userId);
    res.sendStatus(201);
  },
];

const logout = (req: Request, res: Response) => {
  req.session.destroy((err) => {
    if (err) sendError(res, 500, "Couldn't sign you out. Try again.");
    else res.sendStatus(200);
  });
};

const me = (req: Request, res: Response) => {
  if (req.session.userId) res.sendStatus(200);
  else sendError(res, 401, "Not signed in.");
};

// the values each display preference may take; anything else is ignored
const PREF_VALUES: Record<keyof Prefs, string[]> = {
  background: ["sfx", "ink", "pages", "panels"],
  theme: ["light", "dark"],
};

const getPrefs = async (req: Request, res: Response) => {
  res.json(await userQueries.getPrefs(req.session.userId!));
};

const updatePrefs = async (req: Request, res: Response) => {
  const patch: Prefs = {};
  for (const [key, allowed] of Object.entries(PREF_VALUES)) {
    const value = req.body?.[key];
    if (allowed.includes(value)) patch[key as keyof Prefs] = value;
  }
  if (Object.keys(patch).length === 0) {
    res.status(400).json({ error: [{ msg: "Nothing to save" }] });
    return;
  }
  res.json(await userQueries.updatePrefs(req.session.userId!, patch));
};

export default { login, signup, logout, me, getPrefs, updatePrefs };
