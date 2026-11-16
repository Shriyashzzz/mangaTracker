// The books behind a shelf entry's owned volumes (owned_books). The volumes on
// manga stay the truth for everything else; a book is the record of which
// physical book put them there.
import { prisma } from "../config/prisma.js";
import { ownedVolumes } from "../util/shelf/ownedList.js";
import { ownedSet } from "../collector/shelfMath.js";

export type BookInput = {
  isbn13?: string | null;
  edition: string;
  number?: number | null;
  title?: string | null;
  volumes: number[];
  // what they paid, and the day they bought it ("2026-01-05")
  paidCents?: number | null;
  boughtOn?: string | Date | null;
};

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

// a series' books, lowest volume first: those whose volumes are all owned
export async function booksOf(mangaId: number) {
  const manga = await prisma.manga.findUnique({
    where: { id: mangaId },
    select: { volumesOwned: true, ownedList: true, books: true },
  });
  if (!manga) return [];
  return manga.books
    .filter((b) => isShown(b, manga))
    .sort(
      (a, b) =>
        Math.min(...a.volumes, 1e6) - Math.min(...b.volumes, 1e6) ||
        a.id - b.id,
    );
}

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
  const fresh: BookInput[] = [];
  for (const book of books) {
    const tidy = {
      ...book,
      volumes: [...new Set(book.volumes)].sort((a, b) => a - b),
    };
    const there = have.find((h) => sameBook(h, tidy));
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
    if (!fresh.some((f) => sameBook(f, tidy))) fresh.push(tidy);
  }
  if (fresh.length)
    await prisma.ownedBook.createMany({
      data: fresh.map((b) => ({ ...b, boughtOn: dayOf(b.boughtOn), mangaId })),
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
  data: { paidCents?: number | null; boughtOn?: string | null },
) => {
  const { count } = await prisma.ownedBook.updateMany({
    where: { id: bookId, mangaId },
    data: {
      ...("paidCents" in data ? { paidCents: data.paidCents } : {}),
      ...("boughtOn" in data ? { boughtOn: dayOf(data.boughtOn) } : {}),
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

export default {
  booksOf,
  addBooks,
  removeBook,
  shelfBooks,
  setPurchase,
  shelfSpent,
};
