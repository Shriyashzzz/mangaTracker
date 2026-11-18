// "Which volumes are in this book?" When the app can't work out what an
// edition's book holds (no title, table, line or name says), it asks the
// reader who scanned it rather than guess. Two things come of an answer, the
// same way as a series picked on an import (importPicks.ts):
//
//   - it's theirs: their next scan of that book takes it
//   - it's a vote: once AGREE_TO_SHARE readers have said the same volumes for
//     the same ISBN, it's the answer for everyone. One reader's slip never
//     reaches anyone else
//
// An answer is the reader's own data, deleted with their account.
import { prisma } from "../../config/prisma.js";

// how many different readers must agree before an answer is everyone's
export const AGREE_TO_SHARE = 3;

const tidy = (volumes: number[]) => [...new Set(volumes)].sort((a, b) => a - b);

// what they said this book holds (replacing what they said before)
export async function saveBookVolumes(
  userId: number,
  isbn13: string,
  volumes: number[],
) {
  const row = { volumes: tidy(volumes), answeredAt: new Date() };
  await prisma.bookVolumeAnswer.upsert({
    where: { userId_isbn13: { userId, isbn13 } },
    create: { userId, isbn13, ...row },
    update: row,
  });
}

// The volumes this book holds as readers have said: this reader's own
// answer first, else the one enough readers agree on, else null
export async function answeredVolumes(
  isbn13: string,
  userId?: number | null,
): Promise<number[] | null> {
  const answers = await prisma.bookVolumeAnswer.findMany({
    where: { isbn13 },
    select: { userId: true, volumes: true },
    // far more than ever agree on one book
    take: 500,
  });
  const theirs = answers.find((a) => a.userId === userId);
  if (theirs) return tidy(theirs.volumes);
  const votes = new Map<string, number>();
  for (const answer of answers) {
    const said = tidy(answer.volumes).join(",");
    votes.set(said, (votes.get(said) ?? 0) + 1);
  }
  for (const [said, readers] of votes)
    if (readers >= AGREE_TO_SHARE) return said.split(",").map(Number);
  return null;
}
