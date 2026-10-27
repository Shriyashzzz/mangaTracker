// Accounts and their display preferences.
import bcrypt from "bcryptjs";
import { prisma } from "../config/prisma.js";
import { Prisma } from "../../generated/prisma/client.js";

export type Prefs = { background?: string; theme?: string };

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

export default { checkCredentials, addUser, getPrefs, updatePrefs };
