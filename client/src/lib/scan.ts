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
      // the series on their shelf, for its Edit link
      id: number;
      undo: () => Promise<void>;
    }
  | { kind: "already"; book: ScannedBook; name: string; id: number }
  | { kind: "unknown"; isbn: string }
  | { kind: "failed"; isbn: string };

// what one series on the shelf owns right now
const ownedNow = async (id: number): Promise<Owned> => {
  const { manga } = await getJson<{ manga: Manga }>(`/api/manga/${id}`);
  return { volumesOwned: manga.volumesOwned, ownedList: manga.ownedList ?? [] };
};

// the volumes one scan put on, taken back off, whatever else has changed
// since (a book like "Vinland Saga, Book 9" is two)
const takeBack = async (id: number, volumes: number[]) => {
  const now = await ownedNow(id);
  await setVolumesOwned(
    id,
    ownedVolumes(
      null,
      ownedOf(now).filter((v) => !volumes.includes(v)),
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
  // a book holding two volumes may bring one they already had: undo takes
  // back only what this scan added
  const added = book.volumes.filter((v) => !owns(owned, v));
  if (!added.length) return { kind: "already", book, name, id };
  await setVolumesOwned(
    id,
    added.reduce((all, v) => withVolume(all, v), owned),
  );
  return {
    kind: "marked",
    book,
    name,
    id,
    undo: () => takeBack(id, added),
  };
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
        volumesOwned: Math.max(...book.volumes),
        ownedList: book.volumes,
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
      id,
      name: book.shelfName,
      // the series goes again only if this is still all they own of it; a
      // later scan's volume keeps it on the shelf
      undo: async () => {
        const now = ownedOf(await ownedNow(id));
        if (now.some((v) => !book.volumes.includes(v)))
          return takeBack(id, book.volumes);
        const gone = await apiFetch(`/api/manga/${id}`, { method: "DELETE" });
        if (!gone.ok) throw new Error("Couldn't take it off the shelf");
      },
    };
  } catch {
    return { kind: "failed", isbn };
  }
}
