// What makes two titles the same series on a shelf: "One Piece", "one-piece",
// "One  Piece" and "OnePiece" all count as one. Titles with no Latin letters have
// nothing to slug, so those are compared as written, less any spaces, or every one
// would look the same.
import { slugify } from "../../prices/stores/match.js";

export const titleKey = (name: string) =>
  slugify(name).replaceAll("-", "") || name.replace(/\s+/g, "").toLowerCase();

// the manga and the light novel of a series can both be on a shelf
export const isOnShelf = (
  name: string,
  shelf: { id: number; name: string; lightNovel?: boolean }[],
  // an edit can keep its own name
  exceptId?: number,
  lightNovel = false,
) =>
  shelf.some(
    (m) =>
      m.id !== exceptId &&
      Boolean(m.lightNovel) === lightNovel &&
      titleKey(m.name) === titleKey(name),
  );
