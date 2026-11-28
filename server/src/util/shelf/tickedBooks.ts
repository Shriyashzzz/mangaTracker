// A spine ticked while a series is collected in an edition is that
// edition's book: Vagabond's first three volumes ticked as Definitive are
// "Definitive 1", and stay so when the shelf is later looked at as VIZBIG.
//
// Ticking only ever saved the volumes (1, 2, 3), and "Your books" named
// them by whichever edition was picked at that moment, so switching the
// edition renamed books someone had bought. Now each book of the picked
// edition that a save completes is recorded, as "On my shelf" on Buy next
// records one (client lib/booksApi.ts ownEditionBook).
//
// Only for an edition they picked themselves (manga.edition), never a
// guessed one, and only the books this save completed: volumes ticked
// before stay unnamed, since nobody knows which edition they were.
// Unticking needs nothing: a book whose volumes aren't all owned is left
// out of every list (models/bookQueries.ts isShown).
import type { Manga } from "../../../generated/prisma/client.js";
import { prisma } from "../../config/prisma.js";
import { shelfEditionLines } from "../../collector/shelfSeries.js";
import { addBooks } from "../../models/bookQueries.js";
import { bookName } from "../../prices/editionLines.js";
import { editionOfBook } from "./editionStamp.js";
import { shelfBooks } from "./realBooks.js";

// an edition's name for comparing: "Definitive Edition" is "definitive"
const plain = (label: string | null | undefined) =>
  (label ?? "")
    .toLowerCase()
    .replace(/\s+edition$/, "")
    .trim();

// The reader's own day, "2026-11-19", as their page sent it with the save.
// The shelf is drawn by that day (client lib/editionNews.ts todayOf), so
// ticking goes by it too: on release day in Japan the server's UTC day is
// still the day before. Anything that isn't a day, or is more than a day
// off the server's (no time zone is), falls back to the server's own
const DAY = 24 * 60 * 60 * 1000;
export function readersDay(sent: unknown, now = new Date()) {
  const serverDay = now.toISOString().slice(0, 10);
  if (typeof sent !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(sent))
    return serverDay;
  const apart = Math.abs(Date.parse(sent) - Date.parse(serverDay));
  return apart <= DAY ? sent : serverDay;
}

export async function recordTickedBooks(
  manga: Manga,
  // the volumes owned before this save, and after it
  before: Iterable<number>,
  after: Iterable<number>,
  // the reader's day, "2026-11-19" (readersDay): a book still to come isn't
  // on the shelf, and ticking its volumes doesn't record it (realBooks.ts
  // shelfBooks)
  today = readersDay(null),
) {
  if (!manga.edition || manga.edition === "singles" || manga.lightNovel)
    return 0;
  const had = new Set(before);
  const has = new Set(after);
  const line = (await shelfEditionLines([manga])).get(manga.id);
  if (!line) return 0;
  const completed = shelfBooks(line.books, today).filter(
    (book) =>
      book.volumes.length > 0 &&
      book.volumes.every((v) => has.has(v)) &&
      !book.volumes.every((v) => had.has(v)),
  );
  if (!completed.length) return 0;
  // A book they recorded before, holding the same volumes, was kept while
  // a volume of it was unticked (models/bookQueries.ts isShown), and would
  // come back now. The same edition's: it does, with what was paid. Another
  // edition's (a VIZBIG 1, and they're ticking Definitive 1): they let that
  // one go when they unticked it, so it's removed and this one recorded
  const recorded = await prisma.ownedBook.findMany({
    where: { mangaId: manga.id },
  });
  const sameEdition = (book: (typeof recorded)[number]) =>
    plain(editionOfBook(book)?.label) === plain(line.label);
  const fresh = [];
  const gone: number[] = [];
  for (const book of completed) {
    const held = recorded.filter(
      (b) => b.volumes.join() === book.volumes.join(),
    );
    if (held.some(sameEdition)) continue;
    gone.push(...held.map((b) => b.id));
    fresh.push(book);
  }
  if (gone.length)
    await prisma.ownedBook.deleteMany({ where: { id: { in: gone } } });
  if (!fresh.length) return 0;
  return addBooks(
    manga.id,
    fresh.map((book) => ({
      edition: line.kind,
      number: book.number,
      title: book.title ?? bookName(line.label, book.number),
      isbn13: book.isbn13,
      volumes: book.volumes,
    })),
  );
}
