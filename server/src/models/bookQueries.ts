// The books behind a shelf entry's owned volumes (owned_books). The volumes on
// manga stay the truth for everything else; a book is the record of which
// physical book put them there.
import { prisma } from "../config/prisma.js";
import { ownedVolumes } from "../util/shelf/ownedList.js";

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

const ownedSet = (m: { volumesOwned: number | null; ownedList: number[] }) =>
  new Set(
    m.ownedList.length
      ? m.ownedList
      : Array.from({ length: m.volumesOwned ?? 0 }, (_, i) => i + 1),
  );

// a series' books, lowest volume first. One whose volumes aren't all owned
// any more (unticked by hand, or a scan undone) goes here, so nothing that
// changes the owned volumes has to know about books
export async function booksOf(mangaId: number) {
  const manga = await prisma.manga.findUnique({
    where: { id: mangaId },
    select: { volumesOwned: true, ownedList: true, books: true },
  });
  if (!manga) return [];
  const owned = ownedSet(manga);
  const stale = manga.books.filter(
    (b) => !b.volumes.every((v) => owned.has(v)),
  );
  if (stale.length)
    await prisma.ownedBook.deleteMany({
      where: { id: { in: stale.map((b) => b.id) } },
    });
  return manga.books
    .filter((b) => !stale.includes(b))
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
    const kept = new Set(
      manga.books.filter((b) => b.id !== bookId).flatMap((b) => b.volumes),
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

// what a shelf has cost so far: every book with a price paid, added up
export async function shelfSpent(userId: number) {
  const { _sum, _count } = await prisma.ownedBook.aggregate({
    where: { manga: { userId }, paidCents: { not: null } },
    _sum: { paidCents: true },
    _count: true,
  });
  return { cents: _sum.paidCents ?? 0, books: _count };
}

// every book on a shelf, for its backup
export const shelfBooks = (userId: number) =>
  prisma.ownedBook.findMany({
    where: { manga: { userId } },
    orderBy: { id: "asc" },
  });

export default {
  booksOf,
  addBooks,
  removeBook,
  shelfBooks,
  setPurchase,
  shelfSpent,
};
