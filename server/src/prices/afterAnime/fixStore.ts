// Readers' corrections to where a season ends (anime_fixes): sent from the
// page, read by the site's owner, and only an accepted one changes what the
// page says (animeFixes.ts).
import { prisma } from "../../config/prisma.js";
import type { AcceptedFix } from "./animeFixes.js";

// a series can't be buried in suggestions nobody has read yet
const MOST_WAITING = 15;

export type NewFix = {
  slug: string;
  name: string;
  label: string;
  chapter: number | null;
  volume: number | null;
  source: string;
  note: string | null;
};

// false when the series already has too many waiting
export async function suggestFix(fix: NewFix) {
  const waiting = await prisma.animeFix.count({
    where: { slug: fix.slug, status: "pending" },
  });
  if (waiting >= MOST_WAITING) return false;
  await prisma.animeFix.create({ data: fix });
  return true;
}

// the accepted ones for a series, oldest first (the newest wins)
export async function acceptedFixes(slug: string): Promise<AcceptedFix[]> {
  return prisma.animeFix.findMany({
    where: { slug, status: "accepted" },
    orderBy: { decidedAt: "asc" },
    select: { label: true, chapter: true, volume: true },
  });
}

// every series with an accepted fix, for the list of shows
export async function slugsWithFixes() {
  const rows = await prisma.animeFix.findMany({
    where: { status: "accepted" },
    distinct: ["slug"],
    select: { slug: true },
  });
  return new Set(rows.map((row) => row.slug));
}

// for the owner's review page: what's waiting, oldest first, then what was
// decided lately
export async function fixesToReview() {
  const [waiting, decided] = await Promise.all([
    prisma.animeFix.findMany({
      where: { status: "pending" },
      orderBy: { createdAt: "asc" },
      take: 200,
    }),
    prisma.animeFix.findMany({
      where: { status: { not: "pending" } },
      orderBy: { decidedAt: "desc" },
      take: 30,
    }),
  ]);
  return { waiting, decided };
}

// accept or reject one; null when there's no such fix
export async function decideFix(id: number, status: "accepted" | "rejected") {
  const found = await prisma.animeFix.findUnique({ where: { id } });
  if (!found) return null;
  return prisma.animeFix.update({
    where: { id },
    data: { status, decidedAt: new Date() },
  });
}
