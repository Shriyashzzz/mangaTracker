// Trusted books (trusted_books): printed English books we know for certain,
// from a source better than the free catalogs, a collector's hand-kept list
// first (scripts/loadTrustedBooks.ts loads any such file).
//
// The catalogs sometimes give a volume an ISBN no store sells: VIZ's ebook
// ISBNs mostly, which they don't mark as ebooks (every volume of A Tropical
// Fish Yearns for Snow, 2 eBay listings against 27 for the printed book).
// So when a series' list is built, a trusted book of the same volume:
//   - fills a number the catalogs had no book for
//   - takes the place of the listed ISBN, but only when no store looking
//     books up by ISBN has priced that one as a print copy (US or Canada;
//     pricedIsbns). Such an ISBN is a real book someone sells, and stays,
//     whatever the trusted list says
// and nothing else changes. Never on a series with a hand-set reissue
// (reissue.ts), a series sold as books holding several volumes, or another
// publisher's run (the list's ISBNs and the trusted ones must share a
// publisher's block), and only a book of the page's kind (manga or novel).
//
// A swap is remembered (isbn_swaps), and what readers had on the old ISBN
// follows it: To buy items, reviews, "which volumes are in this book"
// answers and scanned books. An old address goes to the new volume
// (currentIsbn, used where each route reads its ISBN).
import { prisma } from "../config/prisma.js";
import { Prisma } from "../../generated/prisma/client.js";
import { coverPath } from "./sources/covers.js";
import { isNovelName, baseName } from "./lightNovel.js";
import { seriesOf } from "./stores/match.js";
import type { CatalogBook, SeriesInfo } from "./types.js";

export type TrustedRow = {
  isbn13: string;
  source: string;
  trust: number;
  series: string;
  seriesKey: string;
  kind: string;
  volume: number | null;
  holds: number[];
  title: string;
  publisher: string | null;
  published: string | null;
  pages: number | null;
  ends?: boolean;
};

export type Swap = { from: string; to: string; volume: number; source: string };

// a series list's book: every one has a number
type ListedBook = CatalogBook & { volume: number };

// the start of an ISBN, as far as tells publishers apart (as seriesService's
// publisherCheck does): 978 and four more
const blockOf = (isbn13: string) => isbn13.trim().slice(0, 7);

// how a series' name compares with a trusted book's, whatever its kind
export const trustedSeriesKey = (name: string) => seriesOf(baseName(name));

// the names a series page may be known by, as trusted books are keyed
export const seriesKeysOf = (name: string, info: SeriesInfo | null) => [
  ...new Set(
    [name, info?.name, ...(info?.altNames ?? [])]
      .filter((n): n is string => Boolean(n))
      .map(trustedSeriesKey),
  ),
];

// Of the trusted books for one volume, the one a list should give: one of
// the series' publisher's first, then the most trusted, then the lowest
// ISBN, so the same books always give the same answer
function pick(rows: TrustedRow[], houseBlocks: Set<string>) {
  return [...rows].sort(
    (a, b) =>
      Number(houseBlocks.has(blockOf(b.isbn13))) -
        Number(houseBlocks.has(blockOf(a.isbn13))) ||
      b.trust - a.trust ||
      a.isbn13.localeCompare(b.isbn13),
  )[0];
}

// The series' list with its trusted books in (the rules above), and the
// swaps it made. `priced`: the listed ISBNs some store has priced.
// `lastVolume`: the series' last volume, when it's finished and the count is
// known; nothing past it is added
export function applyTrusted(
  name: string,
  listed: ListedBook[],
  trusted: TrustedRow[],
  priced: Set<string>,
  lastVolume: number | null = null,
): {
  volumes: ListedBook[];
  swaps: Swap[];
  // whether the list took its trusted books at all (the same publisher's
  // run, lone volumes): what they say of the series counts only then
  used: boolean;
} {
  const kind = isNovelName(name) ? "novel" : "single";
  const rows = trusted.filter(
    (r) =>
      r.kind === kind &&
      r.volume != null &&
      Number.isInteger(r.volume) &&
      r.volume >= 1,
  );
  if (!rows.length) return { volumes: listed, swaps: [], used: false };
  // a series sold as books holding several volumes takes no lone ones
  if (listed.some((v) => v.inBook))
    return { volumes: listed, swaps: [], used: false };

  // the same publisher's run: the list has a book in a block the trusted
  // books use too (an empty list has nothing to disagree with)
  const listedBlocks = new Set(listed.map((v) => blockOf(v.isbn13)));
  const trustedBlocks = new Set(rows.map((r) => blockOf(r.isbn13)));
  const sameRun =
    !listed.length || [...trustedBlocks].some((b) => listedBlocks.has(b));
  if (!sameRun) return { volumes: listed, swaps: [], used: false };

  const trustedIsbns = new Set(trusted.map((r) => r.isbn13));
  const listedIsbns = new Set(listed.map((v) => v.isbn13.trim()));
  const byNumber = new Map(listed.map((v) => [v.volume, v]));
  const byVolume = new Map<number, TrustedRow[]>();
  for (const r of rows)
    byVolume.set(r.volume!, [...(byVolume.get(r.volume!) ?? []), r]);

  const swaps: Swap[] = [];
  for (const [n, here] of byVolume) {
    if (lastVolume != null && n > lastVolume) continue;
    const ours = byNumber.get(n);
    const oursIsbn = ours?.isbn13.trim();
    // the listed book is one of the trusted ones: kept, with what it lacked
    const same = here.find((r) => r.isbn13 === oursIsbn);
    if (ours && same) {
      byNumber.set(n, withDetails(ours, same));
      continue;
    }
    // only a book from a publisher's block the list already has (an empty
    // list has none to keep to): never a stray book, even a trusted list's
    // (a Chinese 978-7 ISBN in one collector's Vagabond 4)
    const choice = pick(
      here.filter(
        (r) =>
          !listedIsbns.has(r.isbn13) &&
          (!listed.length || listedBlocks.has(blockOf(r.isbn13))),
      ),
      listedBlocks,
    );
    if (!choice) continue;
    if (!ours) {
      byNumber.set(n, bookOf(name, n, choice));
      listedIsbns.add(choice.isbn13);
      continue;
    }
    // a book some store sells, or one itself trusted, is never swapped out
    if (priced.has(oursIsbn!) || trustedIsbns.has(oursIsbn!)) continue;
    // the trusted book's own details, the listed one's where it has none
    byNumber.set(n, {
      ...ours,
      isbn13: choice.isbn13,
      coverUrl: coverPath(choice.isbn13),
      publisher: choice.publisher ?? ours.publisher,
      pages: choice.pages ?? ours.pages ?? null,
      published: choice.published ?? ours.published,
    });
    listedIsbns.add(choice.isbn13);
    swaps.push({
      from: oursIsbn!,
      to: choice.isbn13,
      volume: n,
      source: choice.source,
    });
  }
  const volumes = [...byNumber.values()].sort((a, b) => a.volume - b.volume);
  return { volumes, swaps, used: true };
}

// a listed book with the release date and page count it lacked
const withDetails = (book: ListedBook, row: TrustedRow): ListedBook => ({
  ...book,
  ...(!book.published && row.published ? { published: row.published } : {}),
  ...(book.pages == null && row.pages != null ? { pages: row.pages } : {}),
});

// a trusted book as a list's volume, named as gap volumes are
// (seriesService.ts gapVolumes: "Name, Vol. 4")
const bookOf = (name: string, n: number, row: TrustedRow): ListedBook => ({
  isbn13: row.isbn13,
  title: `${name}, Vol. ${n}`,
  authors: null,
  publisher: row.publisher,
  year: row.published ? Number(row.published.slice(0, 4)) || null : null,
  volume: n,
  coverUrl: coverPath(row.isbn13),
  pages: row.pages,
  ...(row.published ? { published: row.published } : {}),
});

// ---------- the database ----------

const ROW_FIELDS = {
  isbn13: true,
  source: true,
  trust: true,
  series: true,
  seriesKey: true,
  kind: true,
  volume: true,
  holds: true,
  title: true,
  publisher: true,
  published: true,
  pages: true,
  ends: true,
} as const;

// A series' trusted books: those under one of its names, and those of any
// series that already shares two or more books with its list (her
// "Kaguya-sama: Love Is War" is our "Kaguya-sama: Love is War")
export async function trustedBooksFor(
  keys: string[],
  isbns: string[],
): Promise<TrustedRow[]> {
  const [named, sharing] = await Promise.all([
    prisma.trustedBook.findMany({
      where: { seriesKey: { in: keys } },
      select: ROW_FIELDS,
    }),
    isbns.length
      ? prisma.trustedBook.findMany({
          where: { isbn13: { in: isbns.map((i) => i.trim()) } },
          select: { seriesKey: true },
        })
      : [],
  ]);
  const shared = new Map<string, number>();
  for (const r of sharing)
    shared.set(r.seriesKey, (shared.get(r.seriesKey) ?? 0) + 1);
  const more = [...shared]
    .filter(([key, n]) => n >= 2 && !keys.includes(key))
    .map(([key]) => key);
  const extra = more.length
    ? await prisma.trustedBook.findMany({
        where: { seriesKey: { in: more } },
        select: ROW_FIELDS,
      })
    : [];
  return [...named, ...extra];
}

// The ISBNs a store has priced as this very printed book, in either
// country: a print copy found by looking the ISBN up. eBay's don't count:
// its title search ("Nisekoi vol 9") finds the printed book's listings and
// they're saved under whatever ISBN the list gives, an ebook's too
// (Nisekoi 9's ebook ISBN had eBay prices and no listing of its own)
const BY_TITLE_TOO = ["eBay", "eBay.ca"];
export async function pricedIsbns(isbns: string[]): Promise<Set<string>> {
  const list = isbns.map((i) => i.trim());
  if (!list.length) return new Set();
  const rows = await prisma.$queryRaw<{ isbn13: string }[]>`
    SELECT DISTINCT isbn13 FROM price_samples
    WHERE isbn13 = ANY(${list}::text[]) AND format = 'print'
      AND store <> ALL(${BY_TITLE_TOO}::text[])
    UNION
    SELECT DISTINCT isbn13 FROM ca_price_samples
    WHERE isbn13 = ANY(${list}::text[]) AND format = 'print'
      AND store <> ALL(${BY_TITLE_TOO}::text[])
  `;
  return new Set(rows.map((r) => r.isbn13.trim()));
}

// A series' finished list with its trusted books in. Failing, the list as
// it was: trusted books never hold a page up
export async function withTrustedBooks(
  name: string,
  info: SeriesInfo | null,
  volumes: ListedBook[],
): Promise<{ volumes: ListedBook[]; swaps: Swap[]; endsAt: number | null }> {
  const isbns = volumes.map((v) => v.isbn13);
  const [trusted, priced] = await Promise.all([
    trustedBooksFor(seriesKeysOf(name, info), isbns),
    pricedIsbns(isbns),
  ]);
  const lastVolume =
    info?.status === "FINISHED" && info.volumes ? info.volumes : null;
  const applied = applyTrusted(name, volumes, trusted, priced, lastVolume);
  return {
    volumes: applied.volumes,
    swaps: applied.swaps,
    // only from books the list took: another publisher's run ending at the
    // same number isn't "complete"
    endsAt: applied.used ? lastInEnglish(name, trusted) : null,
  };
}

// The volume a trusted source marks as the series' last in English
// ("07-Ghost, Vol. 17 (Complete)"), of the page's kind. Two sources naming
// different last volumes: none, since they don't agree
export function lastInEnglish(
  name: string,
  trusted: Pick<TrustedRow, "kind" | "volume" | "ends">[],
): number | null {
  const kind = isNovelName(name) ? "novel" : "single";
  const last = new Set(
    trusted
      .filter((r) => r.ends && r.kind === kind && r.volume != null)
      .map((r) => r.volume!),
  );
  return last.size === 1 ? [...last][0]! : null;
}

// ---------- swaps ----------

// old ISBN -> the one in its place, for every route reading an ISBN
const swapped = new Map<string, string>();
let swapsLoadedAt = 0;
const SWAPS_FRESH_MS = 10 * 60 * 1000;

export async function loadSwaps() {
  const rows = await prisma.isbnSwap.findMany({
    select: { fromIsbn: true, toIsbn: true },
  });
  swapped.clear();
  for (const r of rows) swapped.set(r.fromIsbn.trim(), r.toIsbn.trim());
  swapsLoadedAt = Date.now();
}

// the ISBN a volume goes by now: an old one gives the book that took its
// place. Read from memory (an express-validator sanitizer can't wait), and
// fetched again every few minutes, so another server's swaps arrive too
export function currentIsbn(isbn13: string | null): string | null {
  if (isbn13 && Date.now() - swapsLoadedAt > SWAPS_FRESH_MS) {
    swapsLoadedAt = Date.now();
    loadSwaps().catch(() => (swapsLoadedAt = 0));
  }
  return (isbn13 && swapped.get(isbn13)) ?? isbn13;
}

// Remembers each swap once, and moves what readers had on the old ISBN to
// the new one. A reader who already has the new one keeps theirs: a To buy
// item or an answer on the old ISBN then goes (it's the same volume), a
// review stays where it is (a review is never thrown away)
export async function recordSwaps(seriesKey: string, swaps: Swap[]) {
  for (const s of swaps) {
    if (swapped.get(s.from) === s.to) continue;
    await prisma.$transaction(async (tx) => {
      await tx.isbnSwap.upsert({
        where: { fromIsbn: s.from },
        create: {
          fromIsbn: s.from,
          toIsbn: s.to,
          seriesKey,
          volume: s.volume,
          source: s.source,
        },
        update: { toIsbn: s.to },
      });
      await moveRows(tx, "to_buy", s, true);
      await moveRows(tx, "book_volume_answers", s, true);
      await moveRows(tx, "volume_reviews", s, false);
      await tx.$executeRaw`
        UPDATE owned_books SET isbn13 = ${s.to} WHERE isbn13 = ${s.from}`;
    });
    swapped.set(s.from, s.to);
  }
}

// one table's rows from the old ISBN to the new, one per reader. `dropLeft`:
// a reader's row left on the old ISBN (they had the new one too) goes
async function moveRows(
  tx: Prisma.TransactionClient,
  table: "to_buy" | "book_volume_answers" | "volume_reviews",
  s: Swap,
  dropLeft: boolean,
) {
  const t = Prisma.raw(`"${table}"`);
  await tx.$executeRaw`
    UPDATE ${t} AS o SET isbn13 = ${s.to}
    WHERE o.isbn13 = ${s.from}
      AND NOT EXISTS (
        SELECT 1 FROM ${t} AS n WHERE n.user_id = o.user_id AND n.isbn13 = ${s.to}
      )`;
  if (dropLeft) await tx.$executeRaw`DELETE FROM ${t} WHERE isbn13 = ${s.from}`;
}

// ---------- one book ----------

// a trusted book as the catalog would describe it, for an ISBN no catalog
// knows (a scan of an old Tokyopop book). Null when it isn't one
export async function trustedCatalogBook(
  isbn13: string,
): Promise<CatalogBook | null> {
  const row = await prisma.trustedBook.findUnique({
    where: { isbn13 },
    select: ROW_FIELDS,
  });
  if (!row) return null;
  return {
    isbn13: row.isbn13,
    title: row.title,
    authors: null,
    publisher: row.publisher,
    year: row.published ? Number(row.published.slice(0, 4)) || null : null,
    volume: row.volume,
    coverUrl: coverPath(row.isbn13),
    pages: row.pages,
    ...(row.published ? { published: row.published } : {}),
  };
}

// What a trusted source says about one book, for its page: its English
// release date, page count, the publisher's description and list price.
// Null when no trusted source has it
export async function trustedAbout(isbn13: string) {
  const row = await prisma.trustedBook.findUnique({
    where: { isbn13 },
    select: {
      published: true,
      pages: true,
      description: true,
      listCents: true,
    },
  });
  if (!row) return null;
  const { published, pages, description, listCents } = row;
  if (!published && pages == null && !description && listCents == null)
    return null;
  return { published, pages, description, listCents };
}
