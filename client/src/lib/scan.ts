// A scanned (or typed) ISBN, onto the shelf: which series and volume it is
// (GET /api/prices/scan/:isbn, free sources only, never a paid search), then
// that volume marked theirs, or the series added with it. Each answer carries
// its own undo, which takes back only that one volume: anything scanned since
// stays.
import { apiFetch, getJson, HttpError } from "./api";
import { ownedOf, ownedVolumes, owns, withVolume } from "./ownedVolumes";
import { findOnShelf, setVolumesOwned, type Owned } from "./shelf";
import type { Manga, ScannedBook } from "./types";
import { newBook } from "./books";
import { getBooks, removeBook, saveBooks } from "./booksApi";

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
  // the app can't tell which volumes the book holds: nothing is on the shelf
  // until they say (ScanEdit), and their answer is kept for next time
  | { kind: "unsure"; book: ScannedBook; name: string }
  | { kind: "unknown"; isbn: string }
  | { kind: "failed"; isbn: string };

// what one series on the shelf owns right now
const ownedNow = async (id: number): Promise<Owned> => {
  const { manga } = await getJson<{ manga: Manga }>(`/api/manga/${id}`);
  return { volumesOwned: manga.volumesOwned, ownedList: manga.ownedList ?? [] };
};

// One scan taken back, whatever else has changed since: its book goes, and
// with it the volumes the scan put on (`added`), but never a volume another
// book of theirs holds. A Vagabond VIZBIG 1 undone leaves vols 1 to 3 where
// a Definitive 1 is on the shelf too
const takeBack = async (id: number, book: ScannedBook, added: number[]) => {
  const books = await getBooks(id).catch(() => []);
  const scanned = books.find((b) => b.isbn13 === book.isbn13);
  if (scanned) {
    // the server keeps what their other books hold (bookQueries.removeBook)
    const left = await removeBook(id, scanned.id);
    // and what they'd ticked by hand before this scan stays theirs
    const theirsBefore = book.volumes.filter(
      (v) => !added.includes(v) && !owns(left, v),
    );
    if (theirsBefore.length)
      await setVolumesOwned(
        id,
        theirsBefore.reduce((all, v) => withVolume(all, v), left),
      );
    return;
  }
  // its book was never saved: only the volumes to take off
  const kept = new Set(books.flatMap((b) => b.volumes));
  const now = await ownedNow(id);
  await setVolumesOwned(
    id,
    ownedVolumes(
      null,
      ownedOf(now).filter((v) => !added.includes(v) || kept.has(v)),
    ),
  );
};

// the scanned book itself, kept with its ISBN and edition (lib/books.ts). An
// undo needs no word here: a book whose volumes are no longer owned is dropped
const recordBook = (id: number, book: ScannedBook) =>
  saveBooks(id, [newBook(book.title, book.volumes, book.isbn13)]);

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
  // the volumes may be ticked by hand already: the book itself is still news
  if (!added.length) {
    await recordBook(id, book);
    return { kind: "already", book, name, id };
  }
  await setVolumesOwned(
    id,
    added.reduce((all, v) => withVolume(all, v), owned),
  );
  await recordBook(id, book);
  return {
    kind: "marked",
    book,
    name,
    id,
    undo: () => takeBack(id, book, added),
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
  // never a guess on the shelf: the scan asks which volumes it holds
  if (book.unsure) return { kind: "unsure", book, name: book.shelfName };
  return shelveBook(book);
}

// a scan corrected by hand (ScanEdit): what it put on the shelf is taken
// back, and the series and volumes they chose go on instead
export async function editScan(
  scanned: Extract<ScanResult, { book: ScannedBook }>,
  change: { name: string; volumes: number[] },
): Promise<ScanResult> {
  if ("undo" in scanned) await scanned.undo();
  const { book } = scanned;
  const next = await shelveBook({
    ...book,
    unsure: false,
    volume: change.volumes[0]!,
    volumes: change.volumes,
    shelfName: change.name,
    // a novel goes by "<name> Light Novel" for the shelf match, as scanned
    series: book.lightNovel ? `${change.name} Light Novel` : change.name,
  });
  // what they said an unsure book holds is kept: theirs on their next scan
  // of it, and everyone's once three readers say the same
  if (scanned.kind === "unsure" && next.kind !== "failed")
    void apiFetch("/api/manga/book-volumes", {
      method: "POST",
      body: { isbn13: book.isbn13, volumes: change.volumes },
    }).catch(() => {});
  return next;
}

// a book whose series and volumes are known, onto the shelf
async function shelveBook(book: ScannedBook): Promise<ScanResult> {
  const isbn = book.isbn13;
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
    await recordBook(id, book);
    return {
      kind: "added",
      book,
      id,
      name: book.shelfName,
      // the series goes again only if this is still all they have of it: a
      // later scan's volume keeps it on the shelf, and so does another book
      // holding these same volumes (another edition of them)
      undo: async () => {
        const now = ownedOf(await ownedNow(id));
        const others = (await getBooks(id).catch(() => [])).filter(
          (b) => b.isbn13 !== book.isbn13,
        );
        if (others.length || now.some((v) => !book.volumes.includes(v)))
          return takeBack(id, book, book.volumes);
        const gone = await apiFetch(`/api/manga/${id}`, { method: "DELETE" });
        if (!gone.ok) throw new Error("Couldn't take it off the shelf");
      },
    };
  } catch {
    return { kind: "failed", isbn };
  }
}
