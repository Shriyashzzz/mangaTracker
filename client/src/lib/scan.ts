// A scanned (or typed) ISBN, onto the shelf: which series and volume it is
// (GET /api/prices/scan/:isbn, free sources only, never a paid search), then
// that volume marked theirs, or the series added with it. Each answer carries
// its own undo, which takes back only that one volume: anything scanned since
// stays.
import { apiFetch, getJson, HttpError } from "./api";
import { ownedOf, ownedVolumes, owns, withVolume } from "./ownedVolumes";
import { findOnShelf, setVolumesOwned, type Owned } from "./shelf";
import type { Manga, ScannedBook } from "./types";

// name: the series as their shelf names it ("One Piece", where the catalog
// may say "ONE PIECE")
export type ScanResult =
  | {
      kind: "marked" | "added";
      book: ScannedBook;
      name: string;
      undo: () => Promise<void>;
    }
  | { kind: "already"; book: ScannedBook; name: string }
  | { kind: "unknown"; isbn: string }
  | { kind: "failed"; isbn: string };

// what one series on the shelf owns right now
const ownedNow = async (id: number): Promise<Owned> => {
  const { manga } = await getJson<{ manga: Manga }>(`/api/manga/${id}`);
  return { volumesOwned: manga.volumesOwned, ownedList: manga.ownedList ?? [] };
};

// one volume taken back off, whatever else has changed since
const takeBack = async (id: number, volume: number) => {
  const now = await ownedNow(id);
  await setVolumesOwned(
    id,
    ownedVolumes(
      null,
      ownedOf(now).filter((v) => v !== volume),
    ),
  );
};

// this volume, marked theirs on a series already on the shelf
async function markOn(
  id: number,
  name: string,
  owned: Owned,
  book: ScannedBook,
): Promise<ScanResult> {
  if (owns(owned, book.volume)) return { kind: "already", book, name };
  await setVolumesOwned(id, withVolume(owned, book.volume));
  return { kind: "marked", book, name, undo: () => takeBack(id, book.volume) };
}

export async function shelveScan(isbn: string): Promise<ScanResult> {
  let book: ScannedBook;
  try {
    book = await getJson<ScannedBook>(`/api/prices/scan/${isbn}`);
  } catch (e) {
    // the catalog doesn't know it, or nothing answered
    return e instanceof HttpError && e.status === 404
      ? { kind: "unknown", isbn }
      : { kind: "failed", isbn };
  }
  try {
    const onShelf = await findOnShelf(book.series);
    if (onShelf)
      return await markOn(
        onShelf.id,
        onShelf.name,
        {
          volumesOwned: onShelf.volumesOwned,
          ownedList: onShelf.ownedList ?? [],
        },
        book,
      );
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
    // already there under AniList's name for it: the server says which one
    if (res.status === 409) {
      const { id } = (await res.json()) as { id?: number };
      if (!id) return { kind: "failed", isbn };
      const owned = await ownedNow(id);
      return await markOn(id, book.shelfName, owned, book);
    }
    if (!res.ok) return { kind: "failed", isbn };
    const { id } = (await res.json()) as { id: number };
    return {
      kind: "added",
      book,
      name: book.shelfName,
      // the series goes again only if this is still all they own of it; a
      // later scan's volume keeps it on the shelf
      undo: async () => {
        const now = ownedOf(await ownedNow(id));
        if (now.some((v) => v !== book.volume))
          return takeBack(id, book.volume);
        const gone = await apiFetch(`/api/manga/${id}`, { method: "DELETE" });
        if (!gone.ok) throw new Error("Couldn't take it off the shelf");
      },
    };
  } catch {
    return { kind: "failed", isbn };
  }
}
