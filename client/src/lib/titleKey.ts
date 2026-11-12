// What makes two titles the same series on a shelf, as the server decides it
// (server/src/util/shelf/titleKey.ts, kept in step by a test): case, spaces,
// punctuation and accents aside. Titles with no Latin letters are compared as
// written, less any spaces. The manga and the light novel are two entries
const letters = (name: string) =>
  name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "");

export const titleKey = (name: string) =>
  letters(name) || name.replace(/\s+/g, "").toLowerCase();

export const shelfKey = (name: string, lightNovel = false) =>
  lightNovel ? `${titleKey(name)} (light novel)` : titleKey(name);
