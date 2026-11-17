// A reader's To buy list: volumes they looked up and mean to buy, each with
// its cheapest new and used copy now. Prices come from what's stored: the
// list never asks a store, so opening it costs nothing.
import { prisma } from "../config/prisma.js";
import { hasNoCover } from "../models/coversAndSitemap.js";
import priceQueries from "../models/priceQueries.js";
import type { Country } from "../models/priceTables.js";
import type { CheapestCopy } from "../models/priceHistory.js";
import { notOutYet } from "../prices/preorder.js";
import { getOrCreateBook } from "../prices/service.js";
import { getSeriesInfo } from "../prices/sources/anilist.js";
import { seriesName } from "../prices/stores/match.js";
import { shopName, titleVolume } from "../prices/volumeNames.js";

// plenty for a shopping list, and it keeps one account's list a quick read
export const MOST_TO_BUY = 200;

// a price on the list: how much, and where
type Price = { cents: number; store: string } | null;

export type ToBuyItem = {
  isbn13: string;
  title: string;
  series: string;
  // null for a book that isn't one numbered volume (a box set, a guide)
  volume: number | null;
  // its cover as its own price page has it (none for an edition known to
  // have no picture), and its series' cover to stand in behind it
  coverUrl: string | null;
  seriesCoverUrl: string | null;
  new: Price;
  used: Price;
  // its release date ("2027-03-30", or just "2027-03") while it isn't out
  // yet: a preorder, which is why it has no price
  outOn: string | null;
  addedAt: Date;
};

// the release date of a volume that isn't out yet, from its series' saved
// list; null for one that's out, or whose date nobody knows
const preorderDate = async (isbn13: string) => {
  const saved = await priceQueries.getSavedVolume(isbn13).catch(() => null);
  return notOutYet(saved?.published);
};

// what the list would cost: each kind added up over the volumes that have a
// price of that kind, with how many that is, so the page can say "3 of 5"
export function toBuyTotals(items: Pick<ToBuyItem, "new" | "used">[]) {
  const sum = (kind: "new" | "used") => {
    const priced = items.flatMap((item) => item[kind] ?? []);
    return {
      cents: priced.reduce((total, price) => total + price.cents, 0),
      volumes: priced.length,
    };
  };
  return { volumes: items.length, new: sum("new"), used: sum("used") };
}

const priceOf = (copy: CheapestCopy | null | undefined): Price =>
  copy ? { cents: copy.cents, store: shopName(copy.store) } : null;

// the list, newest first, with its totals
export async function toBuyList(userId: number, country: Country = "us") {
  const rows = await prisma.toBuy.findMany({
    where: { userId },
    orderBy: { addedAt: "desc" },
  });
  const isbns = rows.map((row) => row.isbn13.trim());
  const [books, copies, coverRows] = await Promise.all([
    prisma.book.findMany({ where: { isbn13: { in: isbns } } }),
    priceQueries.getCheapestCopies(isbns, undefined, country),
    priceQueries.getCoverIds(isbns).catch(() => []),
  ]);
  const bookOf = new Map(books.map((b) => [b.isbn13.trim(), b]));
  const coverRowOf = new Map(coverRows.map((c) => [c.isbn13.trim(), c]));
  // each series' own cover, once per series, as the deals list finds it
  const seriesNames = [...new Set(books.map((b) => seriesName(b.title)))];
  const seriesCovers = new Map(
    await Promise.all(
      seriesNames.map(async (name) => {
        const info = await getSeriesInfo(name).catch(() => null);
        return [name, info?.coverUrl ?? null] as const;
      }),
    ),
  );
  // only a volume with no price can be a preorder: the rest aren't asked about
  const unpriced = isbns.filter(
    (isbn13) => !copies.get(isbn13)?.new && !copies.get(isbn13)?.used,
  );
  const outOn = new Map(
    await Promise.all(
      unpriced.map(
        async (isbn13) => [isbn13, await preorderDate(isbn13)] as const,
      ),
    ),
  );
  const items: ToBuyItem[] = rows.flatMap((row) => {
    const isbn13 = row.isbn13.trim();
    const book = bookOf.get(isbn13);
    // its book is gone: nothing to show or price
    if (!book) return [];
    const { title } = book;
    return {
      isbn13,
      title,
      series: seriesName(title),
      volume: titleVolume(title),
      coverUrl: hasNoCover(coverRowOf.get(isbn13)) ? null : book.coverUrl,
      seriesCoverUrl: seriesCovers.get(seriesName(title)) ?? null,
      new: priceOf(copies.get(isbn13)?.new),
      used: priceOf(copies.get(isbn13)?.used),
      outOn: outOn.get(isbn13) ?? null,
      addedAt: row.addedAt,
    };
  });
  return { items, totals: toBuyTotals(items) };
}

// adds a volume. "unknown": no such book; "full": the list is at its most
export async function addToBuy(
  userId: number,
  isbn13: string,
): Promise<"added" | "unknown" | "full"> {
  const book = await getOrCreateBook(isbn13);
  if (!book) return "unknown";
  const [already, count] = await Promise.all([
    prisma.toBuy.findUnique({ where: { userId_isbn13: { userId, isbn13 } } }),
    prisma.toBuy.count({ where: { userId } }),
  ]);
  if (already) return "added";
  if (count >= MOST_TO_BUY) return "full";
  await prisma.toBuy.create({ data: { userId, isbn13 } });
  return "added";
}

// empties the list. Nothing on their shelf changes
export const clearToBuy = (userId: number) =>
  prisma.toBuy.deleteMany({ where: { userId } });

// takes a volume off; one that wasn't there is fine
export const removeToBuy = (userId: number, isbn13: string) =>
  prisma.toBuy.deleteMany({ where: { userId, isbn13 } });
