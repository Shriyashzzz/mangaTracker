// Accounts and their display preferences.
import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { prisma } from "../config/prisma.js";
import { Prisma } from "../../generated/prisma/client.js";

export type Prefs = {
  background?: string;
  theme?: string;
  hideEbooks?: string;
  shelfTab?: string;
  shelfSort?: string;
  // what the New tab lists; see util/releaseStatus.ts
  releases?: unknown;
};

// the account's id when the username and password match, otherwise why not
export async function checkCredentials(
  username: string,
  password: string,
): Promise<{ userId: number } | { status: 401 | 404 }> {
  const user = await prisma.user.findUnique({
    where: { username },
    select: { id: true, password: true },
  });
  if (!user) return { status: 404 };
  if (!(await bcrypt.compare(password, user.password))) return { status: 401 };
  return { userId: user.id };
}

// the new account's id, or null when the username is already taken
export async function addUser(
  username: string,
  password: string,
): Promise<number | null> {
  const hashed = await bcrypt.hash(password, 12);
  try {
    const user = await prisma.user.create({
      data: { username, password: hashed },
      select: { id: true },
    });
    return user.id;
  } catch (e) {
    // P2002 = unique constraint: someone already has that username
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
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
export async function updatePrefs(userId: number, patch: Prefs): Promise<Prefs> {
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
}>;

// the first time sharing goes on, it gets its link
export async function updateAccount(id: number, patch: AccountPatch) {
  const data: AccountPatch & { shareCode?: string } = { ...patch };
  if (patch.shareEnabled) {
    const current = await prisma.user.findUnique({
      where: { id },
      select: { shareCode: true },
    });
    if (!current?.shareCode) data.shareCode = randomBytes(9).toString("base64url");
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

// a shared list, or null if there isn't one at that link
export const getSharedShelf = (shareCode: string) =>
  prisma.user.findFirst({
    where: { shareCode, shareEnabled: true },
    select: {
      id: true,
      displayName: true,
      avatar: true,
      shareNotes: true,
      manga: {
        orderBy: { name: "asc" },
        select: {
          name: true,
          image: true,
          genre: true,
          status: true,
          bookmark: true,
          rating: true,
          description: true,
        },
      },
    },
  });

export default {
  checkCredentials,
  addUser,
  getPrefs,
  updatePrefs,
  getAccount,
  updateAccount,
  deleteAccount,
  getSharedShelf,
};
