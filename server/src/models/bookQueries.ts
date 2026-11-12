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
};

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
      if (!there.isbn13 && tidy.isbn13)
        await prisma.ownedBook.update({
          where: { id: there.id },
          data: { isbn13: tidy.isbn13, title: there.title ?? tidy.title },
        });
      continue;
    }
    if (!fresh.some((f) => sameBook(f, tidy))) fresh.push(tidy);
  }
  if (fresh.length)
    await prisma.ownedBook.createMany({
      data: fresh.map((b) => ({ ...b, mangaId })),
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

// every book on a shelf, for its backup
export const shelfBooks = (userId: number) =>
  prisma.ownedBook.findMany({
    where: { manga: { userId } },
    orderBy: { id: "asc" },
  });

export default { booksOf, addBooks, removeBook, shelfBooks };
