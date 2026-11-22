// One reader's weekly email, gathered from the database: their shelf with
// the saved volume lists and edition lines, their To buy list with the
// prices on file, less what they've been told already. Database only: it
// never asks a store or a catalog, so building one costs nothing.
import { prisma } from "../config/prisma.js";
import { ownedSet } from "../collector/shelfMath.js";
import { shelfEditionLines, shelfSeries } from "../collector/shelfSeries.js";
import { getCheapestCopies, newMedians } from "../models/priceHistory.js";
import { getSavedVolume } from "../models/savedVolumes.js";
import type { Prefs } from "../models/userQueries.js";
import { shopName } from "../prices/volumeNames.js";
import {
  arrivedBooks,
  targetHits,
  type PushNews,
  type ToBuyBook,
} from "../push/pushRules.js";
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
    seenVolume: m.seenVolume,
    hiddenVolumes: m.hiddenVolumes,
  }));
}

// A volume's release day never changes once it's out, so it's asked of the
// saved lists once and remembered; one still to come (or unknown) is asked
// again, since its day can be set or moved
const cameOut = new Map<string, string>();
async function publishedOf(isbn13: string, today: string) {
  const known = cameOut.get(isbn13);
  if (known) return known;
  const saved = await getSavedVolume(isbn13).catch(() => null);
  const published = saved?.published ?? null;
  if (published && /^\d{4}-\d{2}-\d{2}$/.test(published) && published <= today)
    cameOut.set(isbn13, published);
  return published;
}

// their To buy list, each volume with its cheapest copies on file and the
// price they named. `withDays`: with each one's release day too, which only
// the phone alerts need (a volume they were waiting on, out now)
async function toBuyBooksOf(
  userId: number,
  country: "us" | "ca",
  withDays: string | null,
): Promise<ToBuyBook[]> {
  const rows = await prisma.toBuy.findMany({
    where: { userId },
    select: { isbn13: true, addedAt: true, alertCents: true },
  });
  const isbns = rows.map((row) => row.isbn13.trim());
  if (!isbns.length) return [];
  const [books, copies] = await Promise.all([
    prisma.book.findMany({
      where: { isbn13: { in: isbns } },
      select: { isbn13: true, title: true },
    }),
    getCheapestCopies(isbns, undefined, country),
  ]);
  const titleOf = new Map(books.map((b) => [b.isbn13.trim(), b.title]));
  const copyOf = (
    copy: { cents: number; store: string; checkedAt: Date } | null,
  ) =>
    copy
      ? {
          cents: copy.cents,
          store: shopName(copy.store),
          checkedAt: copy.checkedAt,
        }
      : null;
  return Promise.all(
    rows.flatMap((row) => {
      const isbn13 = row.isbn13.trim();
      const title = titleOf.get(isbn13);
      if (!title) return [];
      return [
        (async () => ({
          isbn13,
          title,
          addedAt: row.addedAt,
          published: withDays ? await publishedOf(isbn13, withDays) : null,
          alertCents: row.alertCents,
          new: copyOf(copies.get(isbn13)?.new ?? null),
          used: copyOf(copies.get(isbn13)?.used ?? null),
        }))(),
      ];
    }),
  );
}

// the ones with a new copy on file, each with its usual price (what a
// plain price drop is measured against)
async function pricedVolumes(
  books: ToBuyBook[],
  country: "us" | "ca",
): Promise<PricedVolume[]> {
  const priced = books.filter((book) => book.new);
  if (!priced.length) return [];
  const usual = await newMedians(
    priced.map((book) => book.isbn13),
    country,
  );
  return priced.map((book) => ({
    isbn13: book.isbn13,
    title: book.title,
    cents: book.new!.cents,
    store: book.new!.store,
    checkedAt: book.new!.checkedAt,
    usualCents: usual.get(book.isbn13) ?? null,
  }));
}

// A reader's news as it stands, before what they've been told is taken off,
// and what they've been told (by email, and as alerts on their phone: an
// alert's items start "push:"). The weekly email and the alerts both start
// from this
export async function newsFor(
  user: { id: number; prefs: unknown },
  now = new Date(),
  // the phone alerts' own three kinds as well (push/pushRules.ts)
  forAlerts = false,
) {
  const prefs = (user.prefs ?? {}) as Prefs;
  const today = now.toISOString().slice(0, 10);
  const country = prefs.country === "ca" ? "ca" : "us";
  // release checks switched off in settings: no release news this way either
  const wantsReleases = prefs.releaseChecks !== "off";
  const [shelf, toBuy, told] = await Promise.all([
    wantsReleases ? shelfOf(user.id) : [],
    toBuyBooksOf(user.id, country, forAlerts ? today : null),
    prisma.digestItem.findMany({
      where: { userId: user.id },
      select: { item: true, sentAt: true },
    }),
  ]);
  const news: Digest = {
    ...releaseNews(shelf, today),
    drops: priceDrops(await pricedVolumes(toBuy, country), now),
  };
  const alertNews: PushNews = {
    ...news,
    // every next book with a day, however far off
    ahead: forAlerts ? releaseNews(shelf, today, Infinity).soon : [],
    arrived: forAlerts ? arrivedBooks(toBuy, today) : [],
    targets: forAlerts ? targetHits(toBuy, now) : [],
  };
  return { news, alertNews, told };
}

// what the weekly email would say: their news less what it's already said
export async function digestFor(
  user: { id: number; prefs: unknown },
  now = new Date(),
): Promise<Digest> {
  const { news, told } = await newsFor(user, now);
  return withoutSent(
    news,
    told.filter((t) => !t.item.startsWith(PUSH_PREFIX)),
    now,
  );
}

// an alert's item in digest_items: "push:out:812:15"
export const PUSH_PREFIX = "push:";
