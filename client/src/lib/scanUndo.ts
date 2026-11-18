// A scan taken back off the shelf. Kept apart from scan.ts and handed what
// it needs to read and save (`Shelf`), so the same steps run in the page and
// in a test against the real server (server/src/tests/db/scanUndo.db.test.ts).
import { ownedOf, ownedVolumes, owns, withVolume } from "./ownedVolumes";

type Owned = { volumesOwned: number | null; ownedList: number[] };
type ShelfBook = { id: number; isbn13: string | null; volumes: number[] };

// what an undo reads and saves, on one series
export type Shelf = {
  ownedNow: (id: number) => Promise<Owned>;
  setOwned: (id: number, owned: Owned) => Promise<unknown>;
  books: (id: number) => Promise<ShelfBook[]>;
  // the book goes, with the volumes only it held; what's owned now
  removeBook: (id: number, bookId: number) => Promise<Owned>;
  removeSeries: (id: number) => Promise<void>;
};

type Scanned = { isbn13: string; volumes: number[] };

// One scan taken back, whatever else has changed since: its book goes, and
// with it the volumes the scan put on (`added`), but never a volume another
// book of theirs holds. A Vagabond VIZBIG 1 undone leaves vols 1 to 3 where
// a Definitive 1 is on the shelf too
export async function takeBack(
  shelf: Shelf,
  id: number,
  book: Scanned,
  added: number[],
) {
  const books = await shelf.books(id).catch(() => []);
  const scanned = books.find((b) => b.isbn13 === book.isbn13);
  if (scanned) {
    // the server keeps what their other books hold (bookQueries.removeBook)
    const left = await shelf.removeBook(id, scanned.id);
    // and what they'd ticked by hand before this scan stays theirs
    const theirsBefore = book.volumes.filter(
      (v) => !added.includes(v) && !owns(left, v),
    );
    if (theirsBefore.length)
      await shelf.setOwned(
        id,
        theirsBefore.reduce((all, v) => withVolume(all, v), left),
      );
    return;
  }
  // its book was never saved: only the volumes to take off
  const kept = new Set(books.flatMap((b) => b.volumes));
  const now = await shelf.ownedNow(id);
  await shelf.setOwned(
    id,
    ownedVolumes(
      null,
      ownedOf(now).filter((v) => !added.includes(v) || kept.has(v)),
    ),
  );
}

// The undo of a scan that put the series on the shelf. The series goes again
// only if this book is still all they have of it: a later scan's volume keeps
// it there, and so does another book holding these same volumes (another
// edition of them)
export async function takeBackSeries(shelf: Shelf, id: number, book: Scanned) {
  const now = ownedOf(await shelf.ownedNow(id));
  const others = (await shelf.books(id).catch(() => [])).filter(
    (b) => b.isbn13 !== book.isbn13,
  );
  if (others.length || now.some((v) => !book.volumes.includes(v)))
    return takeBack(shelf, id, book, book.volumes);
  await shelf.removeSeries(id);
}
