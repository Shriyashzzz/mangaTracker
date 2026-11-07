// A scanned (or typed) ISBN, onto the shelf: which series and volume it is
// (GET /api/prices/scan/:isbn, free sources only, never a paid search), then
// that volume marked theirs, or the series added with it. Each answer carries
// its own undo.
import { apiFetch, getJson } from "./api";
import { owns, withVolume } from "./ownedVolumes";
import { findOnShelf, setVolumesOwned } from "./shelf";
import type { ScannedBook } from "./types";

// name: the series as their shelf names it ("One Piece", where the catalog
// may say "ONE PIECE")
export type ScanResult =
  | {
      kind: "marked";
      book: ScannedBook;
      name: string;
      undo: () => Promise<void>;
    }
  | {
      kind: "added";
      book: ScannedBook;
      name: string;
      undo: () => Promise<void>;
    }
  | { kind: "already"; book: ScannedBook; name: string }
  | { kind: "unknown"; isbn: string }
  | { kind: "failed"; isbn: string };

export async function shelveScan(isbn: string): Promise<ScanResult> {
  let book: ScannedBook;
  try {
    book = await getJson<ScannedBook>(`/api/prices/scan/${isbn}`);
  } catch (e) {
    // the catalog doesn't know it (404), or nothing answered
    return /couldn't find/i.test((e as Error).message)
      ? { kind: "unknown", isbn }
      : { kind: "failed", isbn };
  }
  try {
    const onShelf = await findOnShelf(book.series);
    if (onShelf) {
      const owned = {
        volumesOwned: onShelf.volumesOwned,
        ownedList: onShelf.ownedList ?? [],
      };
      if (owns(owned, book.volume))
        return { kind: "already", book, name: onShelf.name };
      await setVolumesOwned(onShelf.id, withVolume(owned, book.volume));
      return {
        kind: "marked",
        book,
        name: onShelf.name,
        undo: async () => void (await setVolumesOwned(onShelf.id, owned)),
      };
    }
    // not on the shelf yet: on it, reading, owning this one volume
    const res = await apiFetch("/api/manga", {
      method: "POST",
      body: {
        name: book.shelfName,
        status: false,
        lightNovel: book.lightNovel,
        volumesOwned: book.volume,
        ownedList: [book.volume],
      },
    });
    if (!res.ok) return { kind: "failed", isbn };
    const { id } = (await res.json()) as { id: number };
    return {
      kind: "added",
      book,
      name: book.shelfName,
      undo: async () => {
        await apiFetch(`/api/manga/${id}`, { method: "DELETE" });
      },
    };
  } catch {
    return { kind: "failed", isbn };
  }
}
