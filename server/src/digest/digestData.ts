// One reader's weekly email, gathered from the database: their shelf with
// the saved volume lists and edition lines, their To buy list with the
// prices on file, less what they've been told already. Database only: it
// never asks a store or a catalog, so building one costs nothing.
import { prisma } from "../config/prisma.js";
import { ownedSet } from "../collector/shelfMath.js";
import { shelfEditionLines, shelfSeries } from "../collector/shelfSeries.js";
import { getCheapestCopies, newMedians } from "../models/priceHistory.js";
import type { Prefs } from "../models/userQueries.js";
import { shopName } from "../prices/volumeNames.js";
import {
  priceDrops,
  releaseNews,
  withoutSent,
  type Digest,
  type DigestSeries,
  type PricedVolume,
} from "./digestRules.js";

// their shelf, as the rules read it
async function shelfOf(userId: number): Promise<DigestSeries[]> {
  const manga = await prisma.manga.findMany({ where: { userId } });
  const [listed, lines] = await Promise.all([
    shelfSeries(manga),
    shelfEditionLines(manga),
  ]);
  const volumesOf = new Map(listed.map((s) => [s.manga.id, s.volumes]));
  return manga.map((m) => ({
    mangaId: m.id,
    name: m.name,
    readVolume: m.readVolume,
    owned: [...ownedSet(m)],
    volumes: volumesOf.get(m.id) ?? [],
    line: lines.get(m.id) ?? null,
  }));
}

// their To buy list's volumes that have a new copy on file, each with its
// usual price
async function toBuyOf(
  userId: number,
  country: "us" | "ca",
): Promise<PricedVolume[]> {
  const rows = await prisma.toBuy.findMany({
    where: { userId },
    select: { isbn13: true },
  });
  const isbns = rows.map((row) => row.isbn13.trim());
  if (!isbns.length) return [];
  const [books, copies, usual] = await Promise.all([
    prisma.book.findMany({
      where: { isbn13: { in: isbns } },
      select: { isbn13: true, title: true },
    }),
    getCheapestCopies(isbns, undefined, country),
    newMedians(isbns, country),
  ]);
  return books.flatMap((book) => {
    const isbn13 = book.isbn13.trim();
    const copy = copies.get(isbn13)?.new;
    if (!copy) return [];
    return {
      isbn13,
      title: book.title,
      cents: copy.cents,
      store: shopName(copy.store),
      checkedAt: copy.checkedAt,
      usualCents: usual.get(isbn13) ?? null,
    };
  });
}

export async function digestFor(
  user: { id: number; prefs: unknown },
  now = new Date(),
): Promise<Digest> {
  const prefs = (user.prefs ?? {}) as Prefs;
  const today = now.toISOString().slice(0, 10);
  // release checks switched off in settings: no release news by email either
  const wantsReleases = prefs.releaseChecks !== "off";
  const [shelf, toBuy, sent] = await Promise.all([
    wantsReleases ? shelfOf(user.id) : [],
    toBuyOf(user.id, prefs.country === "ca" ? "ca" : "us"),
    prisma.digestItem.findMany({
      where: { userId: user.id },
      select: { item: true, sentAt: true },
    }),
  ]);
  const digest = {
    ...releaseNews(shelf, today),
    drops: priceDrops(toBuy, now),
  };
  return withoutSent(digest, sent, now);
}
