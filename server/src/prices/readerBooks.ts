// Readers' books as a trusted source. Each book a reader scans onto a
// series, or imports with its ISBN, says "this ISBN is that series' volume
// N" (isbn_sightings). Once three readers agree, it's a trusted book
// (trusted_books, source "readers", trust 2), and series lists take it by
// the same rules as a collector's list (trustedBooks.ts applyTrusted).
//
// What counts, so a few accounts can't put a wrong book in front of
// everyone (as edition reports, util/shelf/editionReports.ts):
//   - single volumes only: one book, one whole volume number
//   - accounts a week old or more, each counted once
//   - at least one of the three scanned it: an imported file's ISBN can be
//     an ebook's, a barcode on a shelf can't
// A source trusted more (a collector's list) is never replaced.
import { prisma } from "../config/prisma.js";
import { isShown } from "../models/bookQueries.js";
import { trustedSeriesKey } from "./trustedBooks.js";
import { baseName, isNovelName } from "./lightNovel.js";

export const READERS_SOURCE = "readers";
export const READERS_TRUST = 2;
const AGREE = 3;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

type SeenBook = {
  isbn13?: string | null;
  edition?: string;
  volumes?: number[];
};
type SeenSeries = { name: string; lightNovel?: boolean | null };

// the one volume a book is, when it's a single volume with an ISBN
const singleVolumeOf = (book: SeenBook) => {
  const [volume, ...more] = book.volumes ?? [];
  if (!book.isbn13 || !/^97[89]\d{10}$/.test(book.isbn13)) return null;
  if ((book.edition ?? "single") !== "single" || more.length) return null;
  if (volume == null || !Number.isInteger(volume) || volume < 1) return null;
  return volume;
};

// Notes what a reader's books say, then makes trusted books of any ISBN
// three readers now agree on. Never throws into the save it follows
export async function noteReaderBooks(
  userId: number,
  series: SeenSeries,
  books: SeenBook[],
  how: "scan" | "import",
) {
  const seen = books.flatMap((book) => {
    const volume = singleVolumeOf(book);
    return volume == null ? [] : [{ isbn13: book.isbn13!, volume }];
  });
  if (!seen.length) return;
  // a novel by its flag or its name ("Overlord Light Novel"); kept under its
  // base name, as a collector's list keeps it, so a title adds the suffix once
  const kind =
    series.lightNovel || isNovelName(series.name) ? "novel" : "single";
  const name = baseName(series.name).slice(0, 200);
  const seriesKey = trustedSeriesKey(series.name).slice(0, 200);
  for (const s of seen)
    await prisma.isbnSighting.upsert({
      where: { userId_isbn13: { userId, isbn13: s.isbn13 } },
      create: {
        userId,
        isbn13: s.isbn13,
        seriesKey,
        series: name,
        kind,
        volume: s.volume,
        how,
      },
      // what they say now wins; a scan stays a scan
      update: {
        seriesKey,
        series: name,
        kind,
        volume: s.volume,
        ...(how === "scan" ? { how } : {}),
      },
    });
  await promoteAgreed(seen.map((s) => s.isbn13));
}

// Each ISBN that three week-old accounts agree on (same series, kind and
// volume), one of them by a scan, becomes a trusted book. A reader's word
// counts only while their book is still on their shelf (bookQueries.ts
// isShown): a scan they undid, or a book or series they removed, takes it
// back. Readers agreeing on two answers for one ISBN: neither is certain
export async function promoteAgreed(isbns: string[], now = Date.now()) {
  if (!isbns.length) return 0;
  const sightings = await prisma.isbnSighting.findMany({
    where: {
      isbn13: { in: isbns },
      user: { createdAt: { lte: new Date(now - WEEK_MS) } },
    },
  });
  const onShelf = await stillShelved(sightings);
  const counted = sightings.filter((s) =>
    onShelf.has(`${s.userId}|${s.isbn13.trim()}`),
  );

  let made = 0;
  for (const isbn13 of new Set(counted.map((s) => s.isbn13.trim()))) {
    const answers = new Map<string, typeof counted>();
    for (const s of counted.filter((c) => c.isbn13.trim() === isbn13)) {
      const key = `${s.seriesKey}|${s.kind}|${s.volume}`;
      answers.set(key, [...(answers.get(key) ?? []), s]);
    }
    const agreed = [...answers.values()].filter(
      (group) => group.length >= AGREE && group.some((s) => s.how === "scan"),
    );
    if (agreed.length !== 1) continue;
    const group = agreed[0]!;
    const had = await prisma.trustedBook.findUnique({
      where: { isbn13 },
      select: { trust: true },
    });
    if (had && had.trust >= READERS_TRUST) continue;
    const { seriesKey, kind, volume } = group[0]!;
    const series = mostSaid(group.map((s) => s.series));
    const title =
      kind === "novel"
        ? `${series} Light Novel, Vol. ${volume}`
        : `${series}, Vol. ${volume}`;
    const data = {
      source: READERS_SOURCE,
      trust: READERS_TRUST,
      series,
      seriesKey,
      kind,
      volume,
      title: title.slice(0, 300),
    };
    await prisma.trustedBook.upsert({
      where: { isbn13 },
      create: { isbn13, ...data },
      update: data,
    });
    made++;
  }
  return made;
}

// "reader|isbn" for each sighting whose book is still shown on that
// reader's shelf
async function stillShelved(sightings: { userId: number; isbn13: string }[]) {
  if (!sightings.length) return new Set<string>();
  const books = await prisma.ownedBook.findMany({
    where: {
      isbn13: { in: [...new Set(sightings.map((s) => s.isbn13.trim()))] },
      manga: { userId: { in: [...new Set(sightings.map((s) => s.userId))] } },
    },
    select: {
      isbn13: true,
      volumes: true,
      manga: { select: { userId: true, volumesOwned: true, ownedList: true } },
    },
  });
  return new Set(
    books
      .filter((b) => isShown(b, b.manga))
      .map((b) => `${b.manga.userId}|${b.isbn13!.trim()}`),
  );
}

// the name most readers gave the series, the first in order on a tie
const mostSaid = (names: string[]) => {
  const counts = new Map<string, number>();
  for (const n of names) counts.set(n, (counts.get(n) ?? 0) + 1);
  return [...counts].sort(
    (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
  )[0]![0];
};

// an import's books, by the id of the shelf series each went to: noted as
// that reader's sightings. Logs a failure, never throws into the import
export async function noteImportedBooks(
  userId: number,
  books: Map<number, SeenBook[]>,
) {
  try {
    const shelf = await prisma.manga.findMany({
      where: { id: { in: [...books.keys()] }, userId },
      select: { id: true, name: true, lightNovel: true },
    });
    for (const m of shelf)
      await noteReaderBooks(userId, m, books.get(m.id) ?? [], "import");
  } catch (e) {
    console.error("noting imported books:", (e as Error).message);
  }
}

// ISBNs three readers have named but that aren't trusted yet (or only by a
// source trusted less, as eBay's guesses), looked at again once a day: one
// agreed on while an account was under a week old counts once it's older,
// with no new scan needed
export async function promotePending() {
  const pending = await prisma.$queryRaw<{ isbn13: string }[]>`
    SELECT s.isbn13 FROM isbn_sightings s
    LEFT JOIN trusted_books t ON t.isbn13 = s.isbn13
    WHERE t.isbn13 IS NULL OR t.trust < ${READERS_TRUST}
    GROUP BY s.isbn13
    HAVING COUNT(*) >= ${AGREE}
  `;
  return promoteAgreed(pending.map((p) => p.isbn13.trim()));
}

const DAY_MS = 24 * 60 * 60 * 1000;
export function startReaderBooks() {
  const run = () =>
    promotePending().catch((e: Error) =>
      console.error("readers' books:", e.message),
    );
  setTimeout(run, 60_000).unref();
  setInterval(run, DAY_MS).unref();
}
