// Accounts and their display preferences.
import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { prisma } from "../config/prisma.js";
import { Prisma } from "../../generated/prisma/client.js";
import type { ReleaseSettings } from "../util/releases/releaseStatus.js";
import { hashOfResetToken, RESET_LINK_MINUTES } from "../util/resetToken.js";

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
} as const;

export const getAccount = (id: number) =>
  prisma.user.findUnique({ where: { id }, select: ACCOUNT_FIELDS });

export type AccountPatch = Partial<{
  displayName: string | null;
  avatar: string | null;
  recoveryEmail: string | null;
  shareEnabled: boolean;
  shareNotes: boolean;
  shareRatings: boolean;
  shareProgress: boolean;
}>;

// the first time sharing goes on, it gets its link
export async function updateAccount(id: number, patch: AccountPatch) {
  const data: AccountPatch & { shareCode?: string } = { ...patch };
  if (patch.shareEnabled) {
    const current = await prisma.user.findUnique({
      where: { id },
      select: { shareCode: true },
    });
    if (!current?.shareCode)
      data.shareCode = randomBytes(9).toString("base64url");
  }
  return prisma.user.update({ where: { id }, data, select: ACCOUNT_FIELDS });
}

// false when the password is wrong. Their manga go with them, and so does every
// session they're signed in on, so no other device is left pointing at nothing
export async function deleteAccount(id: number, password: string) {
  const user = await prisma.user.findUnique({
    where: { id },
    select: { password: true },
  });
  if (!user || !(await bcrypt.compare(password, user.password))) return false;
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
  deleteAccount,
  getSharedShelf,
  getUserByEmail,
  fillToken,
  updatePassword,
};
