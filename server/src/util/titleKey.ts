// What makes two titles the same series on a shelf: "One Piece", "one-piece",
// "One  Piece" and "OnePiece" all count as one. Titles with no Latin letters have
// nothing to slug, so those are compared as written, less any spaces, or every one
// would look the same.
import { slugify } from "../prices/match.js";

export const titleKey = (name: string) =>
  slugify(name).replaceAll("-", "") || name.replace(/\s+/g, "").toLowerCase();

export const isOnShelf = (
  name: string,
  shelf: { id: number; name: string }[],
  // an edit can keep its own name
  exceptId?: number,
) =>
  shelf.some((m) => m.id !== exceptId && titleKey(m.name) === titleKey(name));
