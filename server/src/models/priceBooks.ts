// Books and their prices as stored: a book's row, each round of price
// checking, and the prices that stand now. Part of the price queries
// (priceQueries.ts lists the parts).
import { prisma } from "../config/prisma.js";
import { type Book } from "../../generated/prisma/client.js";
import {
  AMAZON,
  BETTER_WORLD_BOOKS,
  BOOKS_A_MILLION,
  EBAY,
  preferDirectRows,
  storeName,
} from "../prices/stores/storeLinks.js";
import { notShownYet } from "../prices/stores/affiliates.js";
import type { Offer } from "../prices/types.js";
import { tablesOf, type Country } from "./priceTables.js";
import { shownOnItsPage } from "./priceAge.js";

export type { Book };

// a book as the catalog hands it to us, before it's stored
type NewBook = Pick<
  Book,
  "isbn13" | "title" | "authors" | "publisher" | "coverUrl" | "year"
>;

export type StoredOffer = Offer & { fetchedAt: Date };

// what kind of copy a price is for, in the history: new print, used and
// marketplace copies together, and ebooks
export type PriceKind = "new" | "marketplace" | "ebook";

// one kind's history: every in-stock price ever stored for it
export type KindHistory = {
  kind: PriceKind;
  listings: number;
  lowCents: number;
  lowAt: Date;
  lowStore: string;
  highCents: number;
  highAt: Date;
  highStore: string;
  medianCents: number;
};

export type PriceHistory = {
  checks: number;
  since: Date | null;
  lastSeen: Date | null;
  kinds: KindHistory[];
};

export const getBook = (isbn13: string) =>
  prisma.book.findUnique({ where: { isbn13 } });

// A person opened this volume's page: remembered on its book, at most once
// an hour (a page asks several times as it loads). The background pricing
// reads it to keep the volumes people open fresh first
export const noteOpened = (isbn13: string) =>
  prisma.$executeRaw`
    UPDATE books SET opened_at = now()
    WHERE isbn13 = ${isbn13}
      AND (opened_at IS NULL OR opened_at < now() - interval '1 hour')
  `;

// only the columns books has: catalog lookups carry extras (volume, ...)
// that Prisma would reject as unknown arguments
export async function upsertBook({
  isbn13,
  title,
  authors,
  publisher,
  coverUrl,
  year,
}: NewBook) {
  const fields = { title, authors, publisher, coverUrl, year };
  await prisma.book.upsert({
    where: { isbn13 },
    create: { isbn13, ...fields },
    update: { ...fields, updatedAt: new Date() },
  });
}

export const getLastCheck = (isbn13: string) =>
  prisma.priceCheck.findUnique({ where: { isbn13 } });

// records one round of fetching. Each source group that answered gets this
// moment as its last check, and its offers (maybe none) saved with it: those
// replace that group's prices, while groups not asked keep theirs.
// price_checks keeps the latest look of any group, for "checked ... ago".
// Canadian checks go to the Canadian tables (priceTables.ts), the same way
export async function saveCheck(
  isbn13: string,
  sources: string[],
  groups: Map<string, Offer[]>,
  country: Country = "us",
) {
  const at = new Date();
  if (country === "ca") return saveCanadaCheck(isbn13, sources, groups, at);
  await prisma.$transaction([
    // only when a source answered: Google Shopping found not needed isn't a look
    ...(sources.length
      ? [
          prisma.priceCheck.upsert({
            where: { isbn13 },
            create: { isbn13, sources, checkedAt: at },
            update: { sources, checkedAt: at },
          }),
        ]
      : []),
    prisma.priceSample.createMany({
      data: [...groups].flatMap(([source, offers]) =>
        offers.map((o) => ({ ...o, isbn13, source, fetchedAt: at })),
      ),
    }),
    ...[...groups.keys()].map((source) =>
      prisma.priceSourceCheck.upsert({
        where: { isbn13_source: { isbn13, source } },
        create: { isbn13, source, checkedAt: at },
        update: { checkedAt: at },
      }),
    ),
  ]);
}

// a Canadian check, saved like saveCheck saves a US one
async function saveCanadaCheck(
  isbn13: string,
  sources: string[],
  groups: Map<string, Offer[]>,
  at: Date,
) {
  await prisma.$transaction([
    ...(sources.length
      ? [
          prisma.caPriceCheck.upsert({
            where: { isbn13 },
            create: { isbn13, sources, checkedAt: at },
            update: { sources, checkedAt: at },
          }),
        ]
      : []),
    prisma.caPriceSample.createMany({
      data: [...groups].flatMap(([source, offers]) =>
        offers.map(
          ({ store, format, condition, priceCents, inStock, url }) => ({
            isbn13,
            store,
            format,
            condition,
            priceCents,
            currency: "CAD",
            inStock,
            url,
            source,
            fetchedAt: at,
          }),
        ),
      ),
    }),
    ...[...groups.keys()].map((source) =>
      prisma.caPriceSourceCheck.upsert({
        where: { isbn13_source: { isbn13, source } },
        create: { isbn13, source, checkedAt: at },
        update: { checkedAt: at },
      }),
    ),
  ]);
}

// when each source group last looked at this volume
export async function getSourceChecks(isbn13: string, country: Country = "us") {
  const { checks } = tablesOf(country);
  const rows = await prisma.$queryRaw<{ source: string; checkedAt: Date }[]>`
    SELECT source, checked_at AS "checkedAt" FROM ${checks}
    WHERE isbn13 = ${isbn13}
  `;
  return new Map(rows.map((r) => [r.source, r.checkedAt]));
}

export type CurrentRow = StoredOffer & { isbn13: string; source: string };

// the prices of each group's last check, as one list: where Google Shopping
// and a store's own listing both have a store, the store's own (our affiliate
// link) wins, and of the rest the most recent copy of each store + format +
// condition. Cheapest first
// A store with its own source (eBay, Amazon, Books-A-Million, Better World Books) that has looked is the word on
// that store: Google Shopping's older row for it stops showing, even when the
// store's own source found none
export const currentOf = (
  rows: CurrentRow[],
  looked: Set<string> = new Set(),
): CurrentRow[] => {
  const latest = new Map<string, CurrentRow>();
  const ownWord = (row: CurrentRow) =>
    row.source === "shopping" &&
    ((looked.has("ebay") && EBAY.test(row.store)) ||
      (looked.has("amazon") && AMAZON.test(row.store)) ||
      (looked.has("books-a-million") && BOOKS_A_MILLION.test(row.store)) ||
      (looked.has("better-world-books") && BETTER_WORLD_BOOKS.test(row.store)));
  for (const found of preferDirectRows(rows)) {
    if (ownWord(found)) continue;
    // a store not shown yet (Walmart), saved before it was left out: not
    // shown anywhere, so every page agrees on a volume's price
    if (notShownYet(found.store)) continue;
    // one store, one name: Google Shopping's spellings as the store links'
    const row = { ...found, store: storeName(found.store) };
    const key = `${row.store}|${row.format}|${row.condition}`;
    const kept = latest.get(key);
    // the newest copy of each; from the same look, the cheaper one
    const newer = kept && new Date(row.fetchedAt) > new Date(kept.fetchedAt);
    const sameLook =
      kept &&
      new Date(row.fetchedAt).getTime() === new Date(kept.fetchedAt).getTime();
    if (!kept || newer || (sameLook && row.priceCents < kept.priceCents))
      latest.set(key, row);
  }
  return [...latest.values()].sort((a, b) => a.priceCents - b.priceCents);
};

export const currentRows = (isbns: string[], country: Country = "us") =>
  prisma.$queryRaw<CurrentRow[]>`
    SELECT ps.isbn13, ps.source, ps.store, ps.format, ps.condition,
           ps.price_cents AS "priceCents", ps.currency, ps.in_stock AS "inStock",
           ps.url, ps.fetched_at AS "fetchedAt"
    FROM ${tablesOf(country).checks} sc
    JOIN ${tablesOf(country).samples} ps
      ON ps.isbn13 = sc.isbn13 AND ps.source = sc.source
     AND ps.fetched_at = sc.checked_at
    WHERE sc.isbn13 = ANY(${isbns}::text[])
  `;

// the groups that have looked at each of these volumes
export const lookedAt = async (isbns: string[], country: Country = "us") => {
  const rows = await prisma.$queryRaw<{ isbn13: string; source: string }[]>`
    SELECT isbn13, source FROM ${tablesOf(country).checks}
    WHERE isbn13 = ANY(${isbns}::text[])
  `;
  const groups = new Map<string, Set<string>>();
  for (const r of rows) {
    const isbn = r.isbn13.trim();
    groups.set(isbn, (groups.get(isbn) ?? new Set()).add(r.source));
  }
  return groups;
};

// a volume's prices now: each source group's from its last check, each
// saying which group it came from
export async function getCurrentRows(isbn13: string, country: Country = "us") {
  const [rows, looked] = await Promise.all([
    currentRows([isbn13], country),
    lookedAt([isbn13], country),
  ]);
  return currentOf(rows, looked.get(isbn13));
}

// the same, as plain offers for the volume's own page (and its preview for
// search engines): prices up to 90 days old, which the page dates
// (priceAge.ts). getCurrentRows keeps them all, for judging a new check
export async function getCurrentOffers(
  isbn13: string,
  country: Country = "us",
): Promise<StoredOffer[]> {
  const rows = await getCurrentRows(isbn13, country);
  return rows
    .filter((row) => shownOnItsPage(row.fetchedAt))
    .map(
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      ({ isbn13: _isbn, source: _source, ...offer }) => offer,
    );
}

export const groupBy = <T, K>(items: T[], keyOf: (item: T) => K) => {
  const groups = new Map<K, T[]>();
  for (const item of items) {
    const key = keyOf(item);
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }
  return groups;
};
