// Reading and saving a series' books (lib/books.ts says what one is).
import { apiFetch, getJson } from "./api";
import type { NewBook, OwnedBook } from "./books";
import { asOwnedBook, type EditionBook, type EditionLine } from "./editions";
import { ownedVolumes } from "./ownedVolumes";
import { setVolumesOwned } from "./shelf";
import { orOffline } from "./offline";

export const getBooks = async (mangaId: number, signal?: AbortSignal) =>
  (await getJson<{ books: OwnedBook[] }>(`/api/manga/${mangaId}/books`, signal))
    .books ?? [];

// recorded after its volumes are marked: only a book whose volumes are owned
// is kept. A failure costs the record, never the scan
export const saveBooks = async (mangaId: number, books: NewBook[]) => {
  if (!books.length) return;
  await apiFetch(`/api/manga/${mangaId}/books`, {
    method: "POST",
    body: { books },
  }).catch(() => {});
};

// what they paid for a book, and the day they bought it; null clears
export const savePurchase = async (
  mangaId: number,
  bookId: number,
  change: { paidCents?: number | null; boughtOn?: string | null },
) => {
  const res = await apiFetch(`/api/manga/${mangaId}/books/${bookId}`, {
    method: "PATCH",
    body: change,
  });
  if (!res.ok) throw new Error(orOffline("Couldn't save what you paid"));
};

// a volume ticked by hand becomes a book, to hold what was paid for it.
// The books as they are afterwards
export const addBooks = async (mangaId: number, books: NewBook[]) => {
  const res = await apiFetch(`/api/manga/${mangaId}/books`, {
    method: "POST",
    body: { books },
  });
  if (!res.ok) throw new Error(orOffline("Couldn't save the book"));
  return ((await res.json()) as { books?: OwnedBook[] }).books ?? [];
};

// the book goes, with the volumes only it held; what's owned now comes back
export const removeBook = async (mangaId: number, bookId: number) => {
  const res = await apiFetch(`/api/manga/${mangaId}/books/${bookId}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("Couldn't remove the book");
  return (await res.json()) as {
    volumesOwned: number | null;
    ownedList: number[];
  };
};

// A book of an edition they own (Berserk's Deluxe 7): its volumes put on
// their shelf, then the book saved with its edition, number and ISBN. In
// that order: the server drops any book whose volumes aren't all owned
// (bookQueries.booksOf), so a book saved first is gone at once. What they
// own afterwards comes back, and the books, or null when the book didn't
// save (its volumes did: the page has to show them either way)
export async function ownEditionBook(
  mangaId: number,
  owned: number[],
  line: EditionLine,
  book: EditionBook,
) {
  const now = await setVolumesOwned(
    mangaId,
    ownedVolumes(null, [...owned, ...book.volumes]),
  );
  const books = await addBooks(mangaId, [asOwnedBook(line, book)]).catch(
    () => null,
  );
  return { owned: now, books };
}
