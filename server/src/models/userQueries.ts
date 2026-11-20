// Accounts and their display preferences.
import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { prisma } from "../config/prisma.js";
import { Prisma } from "../../generated/prisma/client.js";
import type { ReleaseSettings } from "../util/releases/releaseStatus.js";
import { hashOfResetToken, RESET_LINK_MINUTES } from "../util/resetToken.js";
import { isReservedName } from "../util/reservedNames.js";

// the values each display preference may take; anything else is ignored when
// saving (authController's updatePrefs). The Prefs type is made from it
export const PREF_VALUES = {
  background: ["sfx", "ink", "pages", "panels"],
  theme: ["light", "dark", "system"],
  hideEbooks: ["yes", "no"],
  // box sets holding a volume, listed under its single copies; shown unless "yes"
  hideBoxSets: ["yes", "no"],
  shelfTab: ["all", "ongoing", "finished", "new"],
  shelfSort: [
    "",
    "rating-dsc",
    "ch-dsc",
    "vol-dsc",
    "gaps-dsc",
    "added-dsc",
    "name-asc",
  ],
  shelfView: ["covers", "rows"],
  // "off": this reader's manga are never looked up for new releases
  releaseChecks: ["on", "off"],
  // how they keep their place: each series its own way ("series", the
  // default), every series by chapters or by volumes, or both side by side
  trackBy: ["series", "chapters", "volumes", "both"],
  // where they buy: Canada gets Canadian store links beside the US prices
  country: ["us", "ca"],
  // what "Next for you" names for a series with gaps: the volume after the
  // furthest they own ("after", the default) or their first gap ("gap")
  nextFor: ["after", "gap"],
  // To buy offers to add a series not on the shelf when a book of it is
  // marked On my shelf or Ordered; "off": it only takes the book off
  offerAdd: ["on", "off"],
} as const;
export type StringPref = keyof typeof PREF_VALUES;

export type Prefs = {
  [K in StringPref]?: (typeof PREF_VALUES)[K][number];
} & {
  // what the New tab lists; see util/releases/releaseStatus.ts
  releases?: ReleaseSettings;
  // the series at the top of their shared shelf; see util/shelf/shareTop.ts
  shareTop?: string[];
};

// the account's id when the username and password match, otherwise why not
// The account a sign-in names: exactly that username, or else the one
// account whose username differs only in capitals ("ZzEdge" for "zzedge").
// Two such accounts from before sign-ups were checked that way: neither is
// guessed at, only the exact one signs in
async function accountNamed(username: string) {
  const exact = await prisma.user.findUnique({
    where: { username },
    select: { id: true, password: true },
  });
  if (exact) return exact;
  const alike = await prisma.user.findMany({
    where: { username: { equals: username, mode: "insensitive" } },
    select: { id: true, password: true },
    take: 2,
  });
  return alike.length === 1 ? alike[0]! : null;
}

// compared against when no account has the name, so a wrong name takes as
// long to answer as a wrong password (the time can't tell them apart either)
// (made the first time it's needed, at the same cost as a real one)
let noSuchAccount: Promise<string> | null = null;
const noSuchAccountHash = () =>
  (noSuchAccount ??= bcrypt.hash(randomBytes(16).toString("hex"), 12));

// the account's id, or null for a wrong name or password: the two answer the
// same, so signing in can't be used to find out which usernames exist
export async function checkCredentials(
  username: string,
  password: string,
): Promise<{ userId: number } | null> {
  const user = await accountNamed(username);
  const matches = await bcrypt.compare(
    password,
    user?.password ?? (await noSuchAccountHash()),
  );
  return user && matches ? { userId: user.id } : null;
}

// ---------- signing in with Google (src/auth/googleSignIn.ts) ----------

// the account a Google account signs in to, or null
export const getUserByGoogleId = (googleId: string) =>
  prisma.user.findUnique({ where: { googleId }, select: { id: true } });

// "reader482913": for a Google name that can't make a username
const readerUsername = () =>
  `reader${String(randomBytes(4).readUInt32BE() % 1_000_000).padStart(6, "0")}`;

// A Google name as a username: "Sarah Lee" is sarahlee, "Zoë" is zoe. Only
// the letters and numbers usernames allow, at most 36 so a number fits
// after it. Null when that leaves under 4 (佐藤, "Al") or a name kept for
// the site (util/reservedNames.ts)
export function usernameFromName(name: string | null) {
  const plain = (name ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .slice(0, 36);
  if (plain.length < 4 || isReservedName(plain)) return null;
  return plain;
}

// the username a new Google account gets: their name, or their name with a
// number when it's taken (sarahlee2), in any mix of capitals, as sign-up
// counts them. A name that can't be one: reader482913
async function freeGoogleUsername(name: string | null) {
  const base = usernameFromName(name);
  if (!base) return readerUsername();
  for (let n = 1; n <= 50; n++) {
    const candidate = n === 1 ? base : `${base}${n}`;
    const alike = await prisma.user.findFirst({
      where: { username: { equals: candidate, mode: "insensitive" } },
      select: { id: true },
    });
    if (!alike) return candidate;
  }
  return readerUsername();
}

// A new account for a Google account: no password (they can set one in
// Settings), their Google name as its username, and Google's verified email
// as its email, confirmed already (Google checked it). The weekly email stays
// off until they say yes on the site. An email another account has stays
// with that account. Signing in twice at once makes one account: the second
// finds the first
export async function addGoogleUser(google: {
  googleId: string;
  name: string | null;
  email: string | null;
}): Promise<number> {
  const { googleId, name } = google;
  let email =
    google.email && !(await getUserByEmail(google.email)) ? google.email : null;
  for (let tries = 0; tries < 5; tries++) {
    try {
      const user = await prisma.user.create({
        data: {
          username: await freeGoogleUsername(name),
          password: null,
          googleId,
          recoveryEmail: email,
          emailConfirmed: Boolean(email),
          // for the unsubscribe links in the weekly email
          emailCode: email ? newEmailCode() : null,
          weeklyEmail: false,
        },
        select: { id: true },
      });
      return user.id;
    } catch (e) {
      const taken =
        e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";
      if (!taken) throw e;
      // their Google account already has one: that's the one
      const theirs = await getUserByGoogleId(googleId);
      if (theirs) return theirs.id;
      // else the username, or the email, was taken a moment ago: again, with
      // another username and without the email
      email = null;
    }
  }
  throw new Error("No free username for a Google sign-up");
}

// A signed-in account starts signing in with Google too. False when that
// Google account already signs in to another account
export async function linkGoogle(id: number, googleId: string) {
  const owner = await getUserByGoogleId(googleId);
  if (owner) return owner.id === id;
  await prisma.user.update({ where: { id }, data: { googleId } });
  return true;
}

// An account made with Google sets its first password, so the username works
// to sign in too. False when it has one already: changing a password goes
// through the reset email, as it always has
export async function setFirstPassword(id: number, password: string) {
  const hashed = await bcrypt.hash(password, 12);
  const { count } = await prisma.user.updateMany({
    where: { id, password: null },
    data: { password: hashed },
  });
  return count > 0;
}

// the new account's id, or null when the username is already taken
export async function addUser(
  username: string,
  password: string,
  // optional: where a password reset link is sent
  recoveryEmail?: string,
): Promise<number | null> {
  // a name that differs only in capitals from one taken is taken too, so
  // signing in with either case finds one account
  const alike = await prisma.user.findFirst({
    where: { username: { equals: username, mode: "insensitive" } },
    select: { id: true },
  });
  if (alike) return null;
  const hashed = await bcrypt.hash(password, 12);
  try {
    const user = await prisma.user.create({
      data: {
        username,
        password: hashed,
        recoveryEmail: recoveryEmail ?? null,
        // signing up with an address: the weekly email is on, waiting for
        // the press on its confirm link (authController signup mails it)
        weeklyEmail: Boolean(recoveryEmail),
      },
      select: { id: true },
    });
    return user.id;
  } catch (e) {
    // P2002 = unique constraint: someone already has that username
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === "P2002"
    ) {
      return null;
    }
    throw e;
  }
}

export async function getPrefs(userId: number): Promise<Prefs> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { prefs: true },
  });
  return (user?.prefs ?? {}) as Prefs;
}

// merges the given keys into what's stored, leaving the rest alone. Done in
// SQL (jsonb ||) so two tabs saving different keys can't overwrite each other
export async function updatePrefs(
  userId: number,
  patch: Prefs,
): Promise<Prefs> {
  const rows = await prisma.$queryRaw<{ prefs: Prefs }[]>`
    UPDATE users SET prefs = prefs || ${JSON.stringify(patch)}::jsonb
    WHERE id = ${userId}
    RETURNING prefs
  `;
  return rows[0]?.prefs ?? {};
}

const ACCOUNT_FIELDS = {
  username: true,
  displayName: true,
  avatar: true,
  recoveryEmail: true,
  shareEnabled: true,
  shareNotes: true,
  shareRatings: true,
  shareProgress: true,
  shareCode: true,
  // the weekly email: asked for, and whether the address was confirmed
  weeklyEmail: true,
  emailConfirmed: true,
} as const;

// how they sign in, said as yes or no: never the password's hash, never the
// Google ID itself
const SIGN_IN_FIELDS = { password: true, googleId: true } as const;
const withSignIn = <T>({
  password,
  googleId,
  ...account
}: T & { password: string | null; googleId: string | null }) => ({
  ...account,
  hasPassword: password != null,
  google: googleId != null,
});

export async function getAccount(id: number) {
  const user = await prisma.user.findUnique({
    where: { id },
    select: { ...ACCOUNT_FIELDS, ...SIGN_IN_FIELDS },
  });
  return user && withSignIn(user);
}

export type AccountPatch = Partial<{
  displayName: string | null;
  avatar: string | null;
  recoveryEmail: string | null;
  shareEnabled: boolean;
  shareNotes: boolean;
  shareRatings: boolean;
  shareProgress: boolean;
}>;

// a new code for an account's confirm and unsubscribe links
const newEmailCode = () => randomBytes(24).toString("base64url");

// the first time sharing goes on, it gets its link
export async function updateAccount(id: number, patch: AccountPatch) {
  const data: AccountPatch & {
    shareCode?: string;
    emailConfirmed?: boolean;
    emailCode?: string | null;
    weeklyEmail?: boolean;
  } = { ...patch };
  const current = await prisma.user.findUnique({
    where: { id },
    select: { shareCode: true, recoveryEmail: true },
  });
  if (patch.shareEnabled && !current?.shareCode)
    data.shareCode = randomBytes(9).toString("base64url");
  // A different address hasn't been confirmed, and the old one's links stop
  // working. With no address at all there's nowhere to send the weekly email
  const emailChanged =
    patch.recoveryEmail !== undefined &&
    patch.recoveryEmail !== (current?.recoveryEmail ?? null);
  if (emailChanged) {
    data.emailConfirmed = false;
    data.emailCode = patch.recoveryEmail ? newEmailCode() : null;
    if (!patch.recoveryEmail) data.weeklyEmail = false;
    // their first address: the weekly email is on, waiting for the press on
    // its confirm link (nothing weekly goes out before). A changed address
    // keeps what they chose
    else if (!current?.recoveryEmail) data.weeklyEmail = true;
  }
  return withSignIn(
    await prisma.user.update({
      where: { id },
      data,
      select: { ...ACCOUNT_FIELDS, ...SIGN_IN_FIELDS },
    }),
  );
}

// ---------- the weekly email (src/digest/) ----------

// Switches it on or off. On, the account has a code for its links. What the
// caller needs to mail a confirm link comes back; null for no such account
export async function setWeeklyEmail(id: number, on: boolean) {
  const user = await prisma.user.findUnique({
    where: { id },
    select: { emailCode: true },
  });
  if (!user) return null;
  return prisma.user.update({
    where: { id },
    data: {
      weeklyEmail: on,
      ...(on && !user.emailCode ? { emailCode: newEmailCode() } : {}),
    },
    select: {
      username: true,
      recoveryEmail: true,
      emailCode: true,
      emailConfirmed: true,
      weeklyEmail: true,
    },
  });
}

// the link in a confirm email was pressed. False for a code nobody has (an
// old link, after the address changed)
export async function confirmEmailByCode(code: string) {
  const { count } = await prisma.user.updateMany({
    where: { emailCode: code, recoveryEmail: { not: null } },
    data: { emailConfirmed: true },
  });
  return count > 0;
}

// the unsubscribe link in a weekly email: no sign-in needed. False for a
// code nobody has
export async function unsubscribeByCode(code: string) {
  const { count } = await prisma.user.updateMany({
    where: { emailCode: code },
    data: { weeklyEmail: false },
  });
  return count > 0;
}

// false when what they typed doesn't prove it's them: their password, or for
// an account with none (made with Google) their username. Their manga go with
// them, and so does every session they're signed in on, so no other device
// is left pointing at nothing
export async function deleteAccount(
  id: number,
  proof: { password?: string; username?: string },
) {
  const user = await prisma.user.findUnique({
    where: { id },
    select: { password: true, username: true },
  });
  if (!user) return false;
  const proven = user.password
    ? await bcrypt.compare(proof.password ?? "", user.password)
    : proof.username?.toLowerCase() === user.username.toLowerCase();
  if (!proven) return false;
  await prisma.user.delete({ where: { id } });
  await prisma.$executeRaw`DELETE FROM session WHERE (sess->>'userId')::int = ${id}`;
  return true;
}

// the account with this recovery email, or null. Emails are saved in
// lowercase (util/email/emailField.ts), so the one asked for is too
export const getUserByEmail = (email: string) =>
  prisma.user.findUnique({
    where: { recoveryEmail: email.toLowerCase() },
    select: { id: true, username: true },
  });

// saves a reset link's token on the account, as its hash (util/resetToken.ts)
export async function fillToken(token: string, userId: number) {
  const token_ttl = Date.now() + RESET_LINK_MINUTES * 60 * 1000;
  await prisma.user.update({
    where: { id: userId },
    data: {
      reset_token: hashOfResetToken(token),
      reset_token_expiry: token_ttl,
    },
  });
}

// the account a reset link's token was made for, or null
export async function getUserWithToken(token: string) {
  const user = await prisma.user.findUnique({
    where: { reset_token: hashOfResetToken(token) },
  });
  return user;
}

// a shared list, or null if there isn't one at that link
export const getSharedShelf = (shareCode: string) =>
  prisma.user.findFirst({
    where: { shareCode, shareEnabled: true },
    select: {
      id: true,
      displayName: true,
      avatar: true,
      shareNotes: true,
      shareRatings: true,
      shareProgress: true,
      prefs: true,
      manga: {
        orderBy: { name: "asc" },
        select: {
          name: true,
          image: true,
          genre: true,
          status: true,
          planned: true,
          lightNovel: true,
          bookmark: true,
          byVolume: true,
          readVolume: true,
          rating: true,
          description: true,
          volumesOwned: true,
          ownedList: true,
          // (not shared: only to leave another edition's numbers out of
          // the "next volume")
          edition: true,
        },
      },
    },
  });

export const updatePassword = async (
  userId: number,
  newHashedPassword: string,
) => {
  try {
    await prisma.user.update({
      where: { id: userId },
      data: {
        password: newHashedPassword,
        reset_token: null,
        reset_token_expiry: null,
      },
    });
    // whoever was signed in with the old password is signed out
    await prisma.$executeRaw`DELETE FROM session WHERE (sess->>'userId')::int = ${userId}`;
    return true;
  } catch (e) {
    console.error(e);
    return false;
  }
};

export default {
  checkCredentials,
  addUser,
  getPrefs,
  updatePrefs,
  getAccount,
  updateAccount,
  setWeeklyEmail,
  confirmEmailByCode,
  unsubscribeByCode,
  deleteAccount,
  getUserByGoogleId,
  addGoogleUser,
  linkGoogle,
  setFirstPassword,
  getSharedShelf,
  getUserByEmail,
  fillToken,
  updatePassword,
};
