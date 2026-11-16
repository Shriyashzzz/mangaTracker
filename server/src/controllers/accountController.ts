// The account's own details: profile, optional recovery email, list sharing and
// deleting it all. Plus the public view of a shared list.
import type { Request, Response } from "express";
import { directionMarksOff } from "../util/directionMarks.js";
import { body, matchedData, param } from "express-validator";
import { sendError } from "../middlewares/errorHandler.js";
import { rejectInvalid } from "../middlewares/validate.js";
import priceQueries, {
  countryOf,
  type Country,
} from "../models/priceQueries.js";
import userQueries, { type AccountPatch } from "../models/userQueries.js";
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
  body("recoveryEmail")
    .optional({ values: "null" })
    .isString()
    .trim()
    .isLength({ max: 254 })
    .isEmail()
    .withMessage("That doesn't look like an email address."),
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

export default { get, update, remove, shared };
