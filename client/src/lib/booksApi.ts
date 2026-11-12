// Reading and saving a series' books (lib/books.ts says what one is).
import { apiFetch, getJson } from "./api";
import type { NewBook, OwnedBook } from "./books";

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
