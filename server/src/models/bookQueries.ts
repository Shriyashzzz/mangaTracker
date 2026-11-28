// The books behind a shelf entry's owned volumes (owned_books). The volumes on
// manga stay the truth for everything else; a book is the record of which
// physical book put them there.
import { isbn13Ok } from "../prices/sources/catalog.js";
import { prisma } from "../config/prisma.js";
import { ownedVolumes } from "../util/shelf/ownedList.js";
import { ownedSet, type OwnedEditionBook } from "../collector/shelfMath.js";
import { editionOfBook } from "../util/shelf/editionStamp.js";

export type BookInput = {
  isbn13?: string | null;
  edition: string;
  number?: number | null;
  title?: string | null;
  volumes: number[];
  // what they paid, and the day they bought it ("2026-01-05")
  paidCents?: number | null;
  boughtOn?: string | Date | null;
  // lent out to someone (lentOn is set to the day it's saved)
  lentTo?: string | null;
};

// lent to someone: since today; back (empty): neither
const lending = (lentTo: string | null | undefined) =>
  lentTo ? { lentTo, lentOn: new Date() } : { lentTo: null, lentOn: null };

// a day as the database keeps it
const dayOf = (day: string | Date | null | undefined) =>
  day == null ? day : new Date(day);

// A book counts while every volume it holds is owned. One whose volumes
// aren't all owned any more (a volume unticked by hand, a scan undone) is
// kept but left out of every list and total, so ticking the volume again
// brings it back with what was paid. Only removing it deletes it
export const isShown = (
  book: { volumes: number[] },
  manga: { volumesOwned: number | null; ownedList: number[] },
) => {
  const owned = ownedSet(manga);
  return book.volumes.every((v) => owned.has(v));
};

// A series' recorded books, lowest volume first, each with its edition as
// the page names it ("Definitive", "VIZBIG"), read from its own title (null
// for a single volume). `shown`: those whose volumes are all owned.
// `unticked`: those they unticked a volume of, kept so ticking it again
// brings the book back with what was paid. They're on no list; the series
// page only uses them to keep a book it just showed in one piece (client
// pages/Details/useEditions.ts)
export async function recordedBooksOf(mangaId: number) {
  const manga = await prisma.manga.findUnique({
    where: { id: mangaId },
    select: { volumesOwned: true, ownedList: true, books: true },
  });
  if (!manga) return { shown: [], unticked: [] };
  const books = manga.books
    .sort(
      (a, b) =>
        Math.min(...a.volumes, 1e6) - Math.min(...b.volumes, 1e6) ||
        a.id - b.id,
    )
    .map((b) => ({ ...b, label: editionOfBook(b)?.label ?? null }));
  return {
    shown: books.filter((b) => isShown(b, manga)),
    unticked: books.filter((b) => !isShown(b, manga)),
  };
}

// a series' books, lowest volume first: those whose volumes are all owned
export const booksOf = async (mangaId: number) =>
  (await recordedBooksOf(mangaId)).shown;

// every book on a shelf they still have, by the series it's on: for the
// edition stamps on the shelf's cards (util/shelf/editionStamp.ts)
export async function shelfBooksBySeries(userId: number) {
  const books = await prisma.ownedBook.findMany({
    where: { manga: { userId } },
    select: { mangaId: true, title: true, edition: true, volumes: true },
  });
  const bySeries = new Map<number, typeof books>();
  for (const book of books)
    bySeries.set(book.mangaId, [...(bySeries.get(book.mangaId) ?? []), book]);
  return bySeries;
}

// A book saved as one volume that its edition's line says holds several
// (a Definitive scanned before the app knew the edition): its volumes are
// put right, and all of them are owned on its series
export const setBookVolumes = (
  mangaId: number,
  bookId: number,
  book: { volumes: number[]; edition: string; number: number | null },
) =>
  prisma.$transaction(async (tx) => {
    const manga = await tx.manga.findUniqueOrThrow({
      where: { id: mangaId },
      select: { volumesOwned: true, ownedList: true },
    });
    await tx.ownedBook.updateMany({
      where: { id: bookId, mangaId },
      data: book,
    });
    await tx.manga.update({
      where: { id: mangaId },
      data: ownedVolumes(null, [...ownedSet(manga), ...book.volumes]),
    });
  });

const sameBook = (a: BookInput, b: BookInput) =>
  a.isbn13 && b.isbn13
    ? a.isbn13 === b.isbn13
    : a.edition === b.edition &&
      a.volumes.join() === b.volumes.join() &&
      // an ISBN arriving for a book known without one is that book
      !(a.isbn13 && b.isbn13);

// new books on a series; one already there (its ISBN, or the same edition and
// volumes) isn't added twice, and takes an ISBN it lacked
export async function addBooks(mangaId: number, books: BookInput[]) {
  const have = await prisma.ownedBook.findMany({ where: { mangaId } });
  // each copy sent is matched to one copy already there, used up once
  // matched: two of Naruto vol. 1 in a file, one on the shelf, adds the
  // spare; the same file again adds nothing
  const unmatched = [...have];
  const fresh: BookInput[] = [];
  for (const book of books) {
    const tidy = {
      ...book,
      // a mistyped ISBN is dropped, the book kept: it would never match a
      // real book or its price (one typo shouldn't refuse a whole import)
      isbn13: isbn13Ok(book.isbn13) ? book.isbn13 : null,
      volumes: [...new Set(book.volumes)].sort((a, b) => a - b),
    };
    const at = unmatched.findIndex((h) => sameBook(h, tidy));
    const there = at >= 0 ? unmatched.splice(at, 1)[0] : undefined;
    if (there) {
      // it takes what it lacked: an ISBN, what was paid, the day bought
      const gains = {
        ...(!there.isbn13 && tidy.isbn13
          ? { isbn13: tidy.isbn13, title: there.title ?? tidy.title }
          : {}),
        ...(there.paidCents == null && tidy.paidCents != null
          ? { paidCents: tidy.paidCents }
          : {}),
        ...(there.boughtOn == null && tidy.boughtOn != null
          ? { boughtOn: dayOf(tidy.boughtOn) }
          : {}),
      };
      if (Object.keys(gains).length)
        await prisma.ownedBook.update({ where: { id: there.id }, data: gains });
      continue;
    }
    // a spare copy is a book of its own
    fresh.push(tidy);
  }
  if (fresh.length)
    await prisma.ownedBook.createMany({
      data: fresh.map((b) => ({
        ...b,
        boughtOn: dayOf(b.boughtOn),
        ...(b.lentTo ? lending(b.lentTo) : {}),
        mangaId,
      })),
    });
  return fresh.length;
}

// a book given away or sold: it goes, and so do its volumes unless another
// book of theirs holds them too. One transaction
export const removeBook = (mangaId: number, bookId: number) =>
  prisma.$transaction(async (tx) => {
    const manga = await tx.manga.findUnique({
      where: { id: mangaId },
      select: { volumesOwned: true, ownedList: true, books: true },
    });
    const book = manga?.books.find((b) => b.id === bookId);
    if (!manga || !book) return null;
    // the volumes another book they still have holds
    const kept = new Set(
      manga.books
        .filter((b) => b.id !== bookId && isShown(b, manga))
        .flatMap((b) => b.volumes),
    );
    const gone = new Set(book.volumes.filter((v) => !kept.has(v)));
    await tx.ownedBook.delete({ where: { id: bookId } });
    return tx.manga.update({
      where: { id: mangaId },
      data: ownedVolumes(
        null,
        [...ownedSet(manga)].filter((v) => !gone.has(v)),
      ),
      select: { volumesOwned: true, ownedList: true },
    });
  });

// what they paid for a book, and when: either alone, null to clear
export const setPurchase = async (
  mangaId: number,
  bookId: number,
  data: {
    paidCents?: number | null;
    boughtOn?: string | null;
    lentTo?: string | null;
  },
) => {
  const { count } = await prisma.ownedBook.updateMany({
    where: { id: bookId, mangaId },
    data: {
      ...("paidCents" in data ? { paidCents: data.paidCents } : {}),
      ...("boughtOn" in data ? { boughtOn: dayOf(data.boughtOn) } : {}),
      ...("lentTo" in data ? lending(data.lentTo) : {}),
    },
  });
  return count > 0;
};

// what a shelf has cost so far: every book they have with a price paid,
// added up
export async function shelfSpent(userId: number) {
  const paid = await prisma.ownedBook.findMany({
    where: { manga: { userId }, paidCents: { not: null } },
    select: {
      paidCents: true,
      volumes: true,
      manga: { select: { volumesOwned: true, ownedList: true } },
    },
  });
  const counted = paid.filter((b) => isShown(b, b.manga));
  return {
    cents: counted.reduce((sum, b) => sum + (b.paidCents ?? 0), 0),
    books: counted.length,
  };
}

// every book on a shelf they have, for its backup
export async function shelfBooks(userId: number) {
  const books = await prisma.ownedBook.findMany({
    where: { manga: { userId } },
    orderBy: { id: "asc" },
    include: { manga: { select: { volumesOwned: true, ownedList: true } } },
  });
  // each book as the backup saves it, without the shelf entry read beside it
  const withoutManga = ({ manga, ...book }: (typeof books)[number]) => {
    void manga;
    return book;
  };
  return books.filter((b) => isShown(b, b.manga)).map(withoutManga);
}

// each series' books of a bigger edition (VIZBIG, Deluxe, an omnibus, a
// box set) they've said they own: the shelf's worth counts each as the book
// it is, at its own price, or estimated when it has none or no ISBN
// (collector/shelfMath.ts shelfValue). One whose volumes aren't all ticked
// any more is passed over there
export async function editionBooksOf(mangaIds: number[]) {
  const rows = mangaIds.length
    ? await prisma.ownedBook.findMany({
        where: {
          mangaId: { in: mangaIds },
          edition: { not: "single" },
        },
        select: { mangaId: true, isbn13: true, edition: true, volumes: true },
      })
    : [];
  const byManga = new Map<number, OwnedEditionBook[]>();
  for (const { mangaId, isbn13, edition, volumes } of rows) {
    const books = byManga.get(mangaId) ?? [];
    books.push({ isbn13, edition, volumes });
    byManga.set(mangaId, books);
  }
  return byManga;
}

export default {
  booksOf,
  recordedBooksOf,
  editionBooksOf,
  addBooks,
  removeBook,
  shelfBooks,
  shelfBooksBySeries,
  setBookVolumes,
  setPurchase,
  shelfSpent,
};
