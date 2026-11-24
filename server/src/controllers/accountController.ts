// The account's own details: profile, optional recovery email, list sharing and
// deleting it all. Plus the public view of a shared list.
import { applePurchases } from "../plan/applePurchases.js";
import { planFor, platformOf } from "../plan/plan.js";
import { membershipFor } from "../plan/membership.js";
import type { Request, Response } from "express";
import { directionMarksOff } from "../util/directionMarks.js";
import { body, matchedData, param } from "express-validator";
import { sendError } from "../middlewares/errorHandler.js";
import { rejectInvalid } from "../middlewares/validate.js";
import { EMAIL_TAKEN, emailField } from "../util/email/emailField.js";
import priceQueries, {
  countryOf,
  type Country,
} from "../models/priceQueries.js";
import userQueries, { type AccountPatch } from "../models/userQueries.js";
import { mailConfirmLink } from "../digest/digestSender.js";
import { googleSignIn } from "../auth/googleSignIn.js";
import { newPassword } from "./authController.js";
import { AVATARS } from "../util/shelf/avatars.js";
import { defaultReaderName, READER_NAMES } from "../util/shelf/readerNames.js";
import { shelfSeries } from "../collector/shelfSeries.js";
import { ownedVolumes } from "../util/shelf/ownedList.js";
import { toSharedShelf } from "../util/shelf/sharedShelf.js";
import { volumeFacts } from "../util/shelf/sharedVolumes.js";
import { isReservedName, RESERVED_MESSAGE } from "../util/reservedNames.js";
import { follows } from "../friends/friends.js";
import { eitherBlocked } from "../blocks/blocks.js";

// the name they show as until they pick one, and the ideas to pick from
const withNames = <T>(userId: number, account: T) => ({
  ...account,
  defaultName: defaultReaderName(userId),
  nameIdeas: READER_NAMES,
});

// What the catalog adds about each shared series' volumes, in the shelf's
// order. A series they're collecting in another edition (deluxe, 3-in-1) is
// left out: its numbers aren't single volumes'. Each next volume comes with
// its best known price. A database problem only costs these extras, never
// the shelf
type SharedManga = NonNullable<
  Awaited<ReturnType<typeof userQueries.getSharedShelf>>
>["manga"][number];
async function factsFor(manga: SharedManga[], country: Country) {
  const listed = await shelfSeries(manga.filter((m) => !m.edition)).catch(
    () => [],
  );
  const volumesOf = new Map(listed.map((s) => [s.manga, s.volumes]));
  const facts = manga.map((m) => {
    const volumes = volumesOf.get(m);
    if (!volumes) return undefined;
    const { volumesOwned, ownedList } = ownedVolumes(
      m.volumesOwned,
      m.ownedList,
    );
    const owned = ownedList.length
      ? ownedList
      : Array.from({ length: volumesOwned ?? 0 }, (_, i) => i + 1);
    return volumeFacts(owned, volumes);
  });
  // each next volume's best known price, from what's on file
  const nexts = facts.flatMap((f) => f?.next ?? []);
  const prices = await priceQueries
    .getKnownPrices(
      nexts.map((next) => next.isbn13),
      country,
    )
    .catch(() => new Map<string, { priceCents: number }>());
  for (const next of nexts)
    next.fromCents = prices.get(next.isbn13)?.priceCents ?? null;
  return facts;
}

const get = async (req: Request, res: Response) => {
  const account = await userQueries.getAccount(req.session.userId!);
  if (!account) return sendError(res, 404, "No account found.");
  res.json(withNames(req.session.userId!, account));
};

// GET /plan  what their plan allows on the device asking (src/plan/)
const plan = async (req: Request, res: Response) => {
  const found = await planFor(req.session.userId!, platformOf(req));
  if (!found) return sendError(res, 404, "No account found.");
  res.json({ ...found, member: await membershipFor(req.session.userId!) });
};

// POST /plan/apple {signedTransaction}  Collector bought or restored in the
// iPhone app. Apple's signature is checked before the plan changes
// (src/plan/applePurchases.ts); then the plan as it is now
const applePurchase = async (req: Request, res: Response) => {
  const signed = (req.body as { signedTransaction?: unknown })
    ?.signedTransaction;
  if (
    typeof signed !== "string" ||
    signed.length < 20 ||
    signed.length > 20_000
  )
    return sendError(res, 400, "That purchase couldn't be read.");
  const until = await applePurchases.applyPurchase(req.session.userId!, signed);
  if (!until) return sendError(res, 400, "Apple didn't confirm that purchase.");
  res.json({
    ...(await planFor(req.session.userId!, platformOf(req))),
    member: await membershipFor(req.session.userId!),
  });
};

const update = [
  body("displayName")
    .optional({ values: "null" })
    .isString()
    // the invisible characters that turn text around ("right-to-left
    // override" and its kin): kept, they showed a name backwards to others
    .customSanitizer(directionMarksOff)
    .trim()
    .isLength({ max: 40 })
    .withMessage("Keep your name to 40 characters.")
    // names that would pass as the site speaking (or its owner). Other
    // readers' usernames can't be refused: that would tell anyone which
    // usernames exist, which signing in never does
    .custom((name: string) => !isReservedName(name))
    .withMessage(RESERVED_MESSAGE),
  body("avatar").optional({ values: "null" }).isIn(AVATARS),
  emailField("recoveryEmail").optional({ values: "null" }),
  body("shareEnabled").optional().isBoolean({ strict: true }),
  body("shareNotes").optional().isBoolean({ strict: true }),
  body("shareRatings").optional().isBoolean({ strict: true }),
  body("shareProgress").optional().isBoolean({ strict: true }),
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
    // an email belongs to one account
    if (data.recoveryEmail) {
      const owner = await userQueries.getUserByEmail(data.recoveryEmail);
      if (owner && owner.id !== req.session.userId)
        return sendError(res, 409, EMAIL_TAKEN);
    }
    // the address before, so saving the same one again mails nothing
    const before = data.recoveryEmail
      ? await userQueries.getAccount(req.session.userId!)
      : null;
    const saved = await userQueries.updateAccount(req.session.userId!, data);
    // a new address with the weekly email on: it's asked to confirm again
    const newAddress =
      Boolean(data.recoveryEmail) &&
      data.recoveryEmail !== before?.recoveryEmail;
    const mailed =
      newAddress && saved.weeklyEmail && !saved.emailConfirmed
        ? await mailConfirmLink(req.session.userId!)
        : true;
    res.json({
      ...withNames(req.session.userId!, saved),
      ...(mailed ? {} : { confirmNotSent: true }),
    });
  },
];

// the weekly email's switch in settings. On needs an address saved, and
// mails a confirm link until that address has been confirmed
const weeklyEmail = [
  body("on").isBoolean({ strict: true }),
  rejectInvalid,
  async (req: Request, res: Response) => {
    const userId = req.session.userId!;
    const { on } = matchedData(req) as { on: boolean };
    const account = await userQueries.getAccount(userId);
    if (!account) return sendError(res, 404, "No account found.");
    if (on && !account.recoveryEmail)
      return sendError(res, 400, "Save an email first.");
    const mailed = on ? await mailConfirmLink(userId) : true;
    if (!on) await userQueries.setWeeklyEmail(userId, false);
    res.json({
      ...withNames(userId, await userQueries.getAccount(userId)),
      ...(mailed ? {} : { confirmNotSent: true }),
    });
  },
];

// The links in our emails, pressed by someone who may not be signed in: the
// code in the link is all that says whose it is. 404 for a code nobody has
const linkCode = param("code").matches(/^[\w-]{20,40}$/);
const confirmEmail = [
  linkCode,
  rejectInvalid,
  async (req: Request, res: Response) => {
    const done = await userQueries.confirmEmailByCode(matchedData(req).code);
    if (!done) return sendError(res, 404, "This link doesn't work any more.");
    res.sendStatus(204);
  },
];
const unsubscribe = [
  linkCode,
  rejectInvalid,
  async (req: Request, res: Response) => {
    const done = await userQueries.unsubscribeByCode(matchedData(req).code);
    if (!done) return sendError(res, 404, "This link doesn't work any more.");
    res.sendStatus(204);
  },
];

// Deleting the account: proven with their password, or for an account made
// with Google (no password) by typing their username
const remove = [
  body("password").optional().isString(),
  body("username").optional().isString(),
  rejectInvalid,
  async (req: Request, res: Response) => {
    const { password, username } = matchedData(req);
    const deleted = await userQueries.deleteAccount(req.session.userId!, {
      password,
      username,
    });
    if (!deleted) {
      const account = await userQueries.getAccount(req.session.userId!);
      return sendError(
        res,
        401,
        account?.hasPassword
          ? "That password isn't right."
          : "That isn't your username.",
      );
    }
    req.session.destroy(() => res.sendStatus(204));
  },
];

// Settings, Account: this account signs in with Google too. The token from
// Google's button, checked as at sign-in
const linkGoogle = [
  body("credential").isString().isLength({ min: 20, max: 8192 }),
  rejectInvalid,
  async (req: Request, res: Response) => {
    const userId = req.session.userId!;
    const google = await googleSignIn.accountOf(matchedData(req).credential);
    if (!google)
      return sendError(res, 401, "Google didn't confirm that. Try again.");
    if (!(await userQueries.linkGoogle(userId, google.googleId)))
      return sendError(
        res,
        409,
        "That Google account already signs in to another shelf.",
      );
    res.json(withNames(userId, await userQueries.getAccount(userId)));
  },
];

// Settings, Account: an account made with Google sets a password, so its
// username signs in too. Only a first one: changing it is the reset email
const setPassword = [
  newPassword,
  rejectInvalid,
  async (req: Request, res: Response) => {
    const userId = req.session.userId!;
    const set = await userQueries.setFirstPassword(
      userId,
      matchedData(req).password,
    );
    if (!set)
      return sendError(res, 409, "This account has a password already.");
    res.json(withNames(userId, await userQueries.getAccount(userId)));
  },
];

const shared = [
  param("code").matches(/^[\w-]{4,16}$/),
  rejectInvalid,
  async (req: Request, res: Response) => {
    const user = await userQueries.getSharedShelf(matchedData(req).code);
    // either has blocked the other: closed to them, as if it weren't shared
    if (!user || (await eitherBlocked(req.session.userId, user.id)))
      return sendError(res, 404, "This shelf isn't shared.");
    res.json({
      ...toSharedShelf({
        ...user,
        facts: await factsFor(user.manga, countryOf(req.query.country)),
      }),
      // the owner looking at their own shared shelf, who is shown the way
      // to its settings. (Not cached anywhere: it differs by viewer)
      yours: req.session.userId === user.id,
      // the viewer follows it (friends/friends.ts)
      following: await follows(req.session.userId, user.id),
    });
  },
];

export default {
  applePurchase,
  plan,
  get,
  update,
  remove,
  linkGoogle,
  setPassword,
  shared,
  weeklyEmail,
  confirmEmail,
  unsubscribe,
};
