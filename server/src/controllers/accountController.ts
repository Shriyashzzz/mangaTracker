// The account's own details: profile, optional recovery email, list sharing and
// deleting it all. Plus the public view of a shared list.
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
import { sendConfirmMail } from "../digest/digestSender.js";
import { AVATARS } from "../util/shelf/avatars.js";
import { defaultReaderName, READER_NAMES } from "../util/shelf/readerNames.js";
import { shelfSeries } from "../collector/shelfSeries.js";
import { ownedVolumes } from "../util/shelf/ownedList.js";
import { toSharedShelf } from "../util/shelf/sharedShelf.js";
import { volumeFacts } from "../util/shelf/sharedVolumes.js";
import { isReservedName, RESERVED_MESSAGE } from "../util/reservedNames.js";

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
    const saved = await userQueries.updateAccount(req.session.userId!, data);
    // a new address with the weekly email on: it's asked to confirm again
    if (data.recoveryEmail && saved.weeklyEmail && !saved.emailConfirmed)
      await mailConfirmLink(req.session.userId!);
    res.json(withNames(req.session.userId!, saved));
  },
];

// mails the account its confirm link, if its address still needs one. A
// mail that fails to go is logged, never the reason a setting doesn't save
async function mailConfirmLink(userId: number) {
  const user = await userQueries.setWeeklyEmail(userId, true);
  if (!user?.recoveryEmail || !user.emailCode || user.emailConfirmed) return;
  await sendConfirmMail({
    to: user.recoveryEmail,
    username: user.username,
    code: user.emailCode,
  }).catch((e: Error) => console.error("confirm email failed:", e.message));
}

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
    if (on) await mailConfirmLink(userId);
    else await userQueries.setWeeklyEmail(userId, false);
    res.json(withNames(userId, await userQueries.getAccount(userId)));
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

const remove = [
  body("password").isString().notEmpty().withMessage("Enter your password."),
  rejectInvalid,
  async (req: Request, res: Response) => {
    const { password } = matchedData(req);
    const deleted = await userQueries.deleteAccount(
      req.session.userId!,
      password,
    );
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
    res.json({
      ...toSharedShelf({
        ...user,
        facts: await factsFor(user.manga, countryOf(req.query.country)),
      }),
      // the owner looking at their own shared shelf, who is shown the way
      // to its settings. (Not cached anywhere: it differs by viewer)
      yours: req.session.userId === user.id,
    });
  },
];

export default {
  get,
  update,
  remove,
  shared,
  weeklyEmail,
  confirmEmail,
  unsubscribe,
};
