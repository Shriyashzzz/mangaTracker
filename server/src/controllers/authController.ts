// Sign in, sign up, sign out, "am I signed in?" and display preferences.
// Sessions live in Postgres (connect-pg-simple); the cookie only holds its id.
import { appleSignIn } from "../auth/appleSignIn.js";
import type { NextFunction, Request, Response } from "express";
import { body, matchedData } from "express-validator";
import { rejectInvalid } from "../middlewares/validate.js";
import { isReservedName, RESERVED_MESSAGE } from "../util/reservedNames.js";
import { sendError } from "../middlewares/errorHandler.js";
import userQueries, {
  PREF_VALUES,
  type Prefs,
  type StringPref,
} from "../models/userQueries.js";
import { validReleaseSettings } from "../util/releases/releaseStatus.js";
import { validShareTop } from "../util/shelf/shareTop.js";
import { newResetToken } from "../util/resetToken.js";
import { EMAIL_TAKEN, emailField } from "../util/email/emailField.js";
import sendResetPasswordEmail from "../util/email/sendResetPasswordEmail.js";
import { mailConfirmLink } from "../digest/digestSender.js";
import { googleSignIn } from "../auth/googleSignIn.js";
import bcrypt from "bcryptjs";

const credentials = [
  body("username")
    .exists({ values: "falsy" })
    .withMessage("I need your name to let you in, come on you know that!")
    .bail()
    // one name, as text: not a list or an object
    .isString()
    .withMessage("Usernames are letters and numbers only.")
    .bail()
    .trim()
    .notEmpty()
    .withMessage("I need your name to let you in, come on you know that!")
    .isAlphanumeric()
    .withMessage("Usernames are letters and numbers only.")
    // one message a box: "a!" is only told about the letters
    .bail()
    .isLength({ min: 4, max: 40 })
    .withMessage("Usernames need 4 to 40 letters or numbers."),
  body("password")
    .exists({ values: "falsy" })
    .withMessage("Alright, don't forget your secret code. Spill the beans now!")
    .bail()
    .isString()
    .withMessage("Passwords are text.")
    .bail()
    .notEmpty()
    .withMessage("Alright, don't forget your secret code. Spill the beans now!")
    .bail()
    // hashing only reads the first 72 bytes: no reason to take a novel
    .isLength({ max: 200 })
    .withMessage("That password is too long. Keep it under 200 characters.")
    .bail(),
];

// signing in: the old 5 characters, so accounts made before still get in.
// A new account has its own rule (newPassword), so sign-up never says both
const oldPassword = body("password")
  .isLength({ min: 5 })
  .withMessage("Password has to be at least 5 characters long!");

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
  oldPassword,
  rejectInvalid,
  async (req: Request, res: Response) => {
    const { username, password } = matchedData(req);
    const result = await userQueries.checkCredentials(username, password);
    if (!result) {
      res
        .status(401)
        .json({ error: [{ msg: "Incorrect username or password" }] });
      return;
    }
    await startSession(req, result.userId);
    res.sendStatus(200);
  },
];

// a new account's password: at least 8 characters. Signing in keeps the
// old 5, so accounts made before still get in. The sign-up form says it
// too (client SignUp.tsx); tests/site/passwordRule.test.ts fails if the
// two differ
export const NEW_PASSWORD_MIN = 8;
export const newPassword = body("password")
  .isLength({ min: NEW_PASSWORD_MIN })
  .withMessage(`Passwords need at least ${NEW_PASSWORD_MIN} characters.`)
  // eight spaces is no password. Signing in still takes whatever was set
  .bail()
  .custom((password: string) => password.trim().length > 0)
  .withMessage("A password needs more than spaces.");

// the site's own names ("admin", "Kenji") aren't anyone's to take
const notReserved = body("username")
  .custom((name: unknown) => typeof name !== "string" || !isReservedName(name))
  .withMessage(RESERVED_MESSAGE);

// optional on signing up: the recovery email, where a password reset link
// is sent
const optionalEmail = emailField("email").optional({ values: "falsy" });

const signup = [
  ...credentials,
  notReserved,
  newPassword,
  optionalEmail,
  rejectInvalid,
  async (req: Request, res: Response) => {
    const { username, password, email } = matchedData(req);
    if (email && (await userQueries.getUserByEmail(email))) {
      res.status(409).json({ error: [{ msg: EMAIL_TAKEN }] });
      return;
    }
    const userId = await userQueries.addUser(username, password, email);
    if (userId === null) {
      res
        .status(409)
        .json({ error: [{ msg: "That username is taken, try another <3" }] });
      return;
    }
    await startSession(req, userId);
    // with an address, its confirm link for the weekly email: not waited
    // for, so a slow mail never holds up the new account
    if (email) void mailConfirmLink(userId);
    res.sendStatus(201);
  },
];

// Signing in with Google: the token from Google's button, checked with Google
// (src/auth/googleSignIn.ts). An account it signs in to: signed in (200).
// None yet: one is made for it (201), with no password and no email
const google = [
  body("credential").isString().isLength({ min: 20, max: 8192 }),
  rejectInvalid,
  async (req: Request, res: Response) => {
    const google = await googleSignIn.accountOf(matchedData(req).credential);
    if (!google)
      return sendError(res, 401, "Google didn't confirm that. Try again.");
    const found = await userQueries.getUserByGoogleId(google.googleId);
    const userId = found?.id ?? (await userQueries.addGoogleUser(google));
    await startSession(req, userId);
    res.sendStatus(found ? 200 : 201);
  },
];

// POST /apple {identityToken, name?}  signing in with Apple from the iPhone
// app (src/auth/appleSignIn.ts). An account it signs in to: 200. None yet:
// one is made for it (201). `name` is the first name Apple gave the app,
// said only the first time someone signs in
const apple = [
  body("identityToken").isString().isLength({ min: 20, max: 8192 }),
  body("name").optional({ values: "null" }).isString().isLength({ max: 80 }),
  rejectInvalid,
  async (req: Request, res: Response) => {
    const { identityToken, name } = matchedData(req);
    const found = await appleSignIn.accountOf(identityToken);
    if (!found)
      return sendError(res, 401, "Apple didn't confirm that. Try again.");
    const made = await signInApple(req, found, name ?? null);
    res.sendStatus(made ? 201 : 200);
  },
];

// the Apple account's own account, made the first time, signed in to. True
// when it was just made
async function signInApple(
  req: Request,
  found: { appleId: string; email: string | null },
  name: string | null,
) {
  const existing = await userQueries.getUserByAppleId(found.appleId);
  const userId =
    existing?.id ?? (await userQueries.addAppleUser({ ...found, name }));
  await startSession(req, userId);
  return !existing;
}

// the cookie the website's "Continue with Apple" leaves before going to
// Apple (client lib/appleSignIn.ts), holding the visit's nonce
export const APPLE_NONCE_COOKIE = "apple_nonce";

const cookieOf = (req: Request, name: string) =>
  (req.headers.cookie ?? "")
    .split(";")
    .map((part) => part.trim().split("="))
    .find(([key]) => key === name)?.[1] ?? "";

// where to go after: a path on this site, or the shelf
const localPath = (path: unknown) =>
  typeof path === "string" && /^\/(?![/\\])/.test(path) && !/\s/.test(path)
    ? path
    : "/shelf";

// POST /apple/return  the website's sign-in with Apple: Apple's page sends
// the browser back here with a form (id_token, state: where they were going,
// user: their name, said only the first time). Signed in, on to where they
// were going; otherwise back to sign in, saying it didn't work. The nonce in
// the token must be the one this browser left in its cookie, so nobody can
// sign someone in with a token of their own
const appleReturn = async (req: Request, res: Response) => {
  const form = (req.body ?? {}) as Record<string, unknown>;
  res.clearCookie(APPLE_NONCE_COOKIE, { path: "/api/auth/apple" });
  // they pressed Cancel on Apple's page
  if (form.error) return res.redirect(303, "/signin");
  const found =
    typeof form.id_token === "string" && form.id_token.length <= 8192
      ? await appleSignIn.accountOf(
          form.id_token,
          cookieOf(req, APPLE_NONCE_COOKIE),
        )
      : null;
  if (!found) return res.redirect(303, "/signin?apple=failed");
  await signInApple(req, found, firstNameOf(form.user));
  res.redirect(303, localPath(form.state));
};

// the first name in Apple's "user" field: {"name":{"firstName":"Mia"}}
function firstNameOf(user: unknown) {
  if (typeof user !== "string") return null;
  try {
    const name = (JSON.parse(user) as { name?: { firstName?: unknown } }).name
      ?.firstName;
    return typeof name === "string" ? name.trim().slice(0, 80) || null : null;
  } catch {
    return null;
  }
}

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

const getPrefs = async (req: Request, res: Response) => {
  res.json(await userQueries.getPrefs(req.session.userId!));
};

const updatePrefs = async (req: Request, res: Response) => {
  const patch: Prefs = {};
  for (const [key, allowed] of Object.entries(PREF_VALUES)) {
    const value = req.body?.[key];
    if ((allowed as readonly unknown[]).includes(value))
      patch[key as StringPref] = value;
  }
  const releases = validReleaseSettings(req.body?.releases);
  if (releases) patch.releases = releases;
  const shareTop = validShareTop(req.body?.shareTop);
  if (shareTop) patch.shareTop = shareTop;
  if (Object.keys(patch).length === 0) {
    res.status(400).json({ error: [{ msg: "Nothing to save" }] });
    return;
  }
  res.json(await userQueries.updatePrefs(req.session.userId!, patch));
};

const initiateResetPassword = [
  emailField("email"),
  rejectInvalid,
  async (req: Request, res: Response, next: NextFunction) => {
    const { email } = matchedData(req);
    const user = await userQueries.getUserByEmail(email);
    if (user) {
      const token = newResetToken();
      await userQueries.fillToken(token, user.id);
      await sendResetPasswordEmail(token, email, user.username);
    }
    // the same answer whether or not the email has an account, so nobody
    // can test which emails do (the router sends it)
    next();
  },
];

const resetPasswordValidator = [
  body("newPassword")
    .isLength({ min: NEW_PASSWORD_MIN })
    .withMessage(`Passwords need at least ${NEW_PASSWORD_MIN} characters.`)
    // eight spaces is no password. Signing in still takes whatever was set
    .bail()
    .custom((password: string) => password.trim().length > 0)
    .withMessage("A password needs more than spaces."),
  body("confirmPassword")
    .isLength({ min: NEW_PASSWORD_MIN })
    // eight spaces is no password. Signing in still takes whatever was set
    .bail()
    .custom((password: string) => password.trim().length > 0)
    .custom((val, { req }) => {
      if (req.body.confirmPassword !== req.body.newPassword) {
        throw new Error("Both passwords don't match");
      }
      return true;
    }),
];

const resetPassword = [
  ...resetPasswordValidator,
  rejectInvalid,
  async (req: Request, res: Response) => {
    if (!res.locals.resetUserId) return res.sendStatus(400);
    const { newPassword } = matchedData(req);
    const hashNewPassword = await bcrypt.hash(newPassword, 12);
    const resetSuccess = await userQueries.updatePassword(
      res.locals.resetUserId,
      hashNewPassword,
    );
    if (!resetSuccess) return res.sendStatus(500);
    return res.sendStatus(200);
  },
];

export default {
  apple,
  appleReturn,
  login,
  signup,
  google,
  logout,
  me,
  getPrefs,
  updatePrefs,
  resetPassword,
  initiateResetPassword,
};
