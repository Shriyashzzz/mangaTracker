// What makes two titles the same series on a shelf: "One Piece", "one-piece",
// "One  Piece" and "OnePiece" all count as one. Titles with no Latin letters have
// nothing to slug, so those are compared as written, less any spaces, or every one
// would look the same.

// slugify's letters, but the whole name: slugs stop at 80 characters, and two
// long titles that only differ after that ("…Familia Chronicle Episode Freya" and
// "…Episode Lyu") would count as one
const letters = (name: string) =>
  name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "");

export const titleKey = (name: string) =>
  letters(name) || name.replace(/\s+/g, "").toLowerCase();

// the manga and the light novel of a series are two entries: the format is
// part of the key. Book imports group the same way in client/src/lib/imports
export const shelfKey = (key: string, lightNovel: boolean) =>
  lightNovel ? `${key} (light novel)` : key;

// the shelf entry that already holds this title, if any
export const onShelfAs = <
  T extends { id: number; name: string; lightNovel?: boolean },
>(
  name: string,
  shelf: T[],
  // an edit can keep its own name
  exceptId?: number,
  lightNovel = false,
) => {
  const wanted = shelfKey(titleKey(name), lightNovel);
  return shelf.find(
    (m) =>
      m.id !== exceptId &&
      shelfKey(titleKey(m.name), Boolean(m.lightNovel)) === wanted,
  );
};

export const isOnShelf = (
  name: string,
  shelf: { id: number; name: string; lightNovel?: boolean }[],
  exceptId?: number,
  lightNovel = false,
) => Boolean(onShelfAs(name, shelf, exceptId, lightNovel));
