// The book import's rule for when an AniList series is the one a book title
// means, as the browser applies it (client/src/lib/anilist.ts matchFrom). The
// server runs it again on answers people share (sharedMatches.ts), so a wrong
// or made-up answer can't reach anyone else's import. Kept in step with the
// client's by a test (tests/shelf/sharedMatches.test.ts)
import { createHash } from "node:crypto";

// names compared without case, spacing or punctuation. "×" is "x", "&" is
// "and", a leading "The" or "A" doesn't count, and long vowels are spelt the
// way AniList's romaji spells them: "Fushigi Yûgi" is "Fushigi Yuugi"
export const plain = (name: string) =>
  name
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[ûū]/g, "uu")
    .replace(/[ôō]/g, "ou")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .normalize("NFKC")
    .replace(/×/g, "x")
    .replace(/&/g, " and ")
    .replace(/^\s*(the|a|an)\s+/, "")
    .replace(/[^\p{L}\p{N}]+/gu, "");

const SHARED_AT_LEAST = 5;
// a slash joins two names, it starts no subtitle (client/src/lib/anilist.ts)
const SUBTITLE_MARK = /^[\s]*[:\-–—(~|]/;
const JUST_THE_FORMAT = /^(the)?(manga|comics?|graphicnovel)$/;

// "Chunchu: The Genocide Fiend" carries on from "Chunchu" after a colon, so
// it's that series with its subtitle; "Justice Now!" just carries on
function subtitleAfter(name: string, wanted: string) {
  for (let i = 0; i < name.length; i++) {
    const said = plain(name.slice(0, i + 1));
    if (said.length >= wanted.length) {
      const rest = name.slice(i + 1);
      return (
        said === wanted &&
        (SUBTITLE_MARK.test(rest) ||
          /^[!?.]/.test(rest) ||
          JUST_THE_FORMAT.test(plain(rest)))
      );
    }
  }
  return false;
}

// could the import have picked a series with these names for this search? It's
// called exactly that, or (not exact-only) one is the other plus a subtitle
export function fitsSearch(search: string, names: string[], exactOnly: boolean) {
  const wanted = plain(search);
  if (!wanted) return false;
  if (names.some((n) => plain(n) === wanted)) return true;
  if (exactOnly || wanted.length < SHARED_AT_LEAST) return false;
  return names.some((name) => {
    const t = plain(name);
    if (t.length < SHARED_AT_LEAST) return false;
    return (
      (wanted.startsWith(t) && t !== wanted) ||
      (t.startsWith(wanted) && subtitleAfter(name, wanted))
    );
  });
}

// a search as the import asks it (store/bookImport.ts searchKey), hashed: the
// table never holds anyone's book titles
// v2: only exact names are shared (sharedMatches.ts fits), so rows from
// before, which may hold a subtitle guess, are never read again
const MATCH_KEY_VERSION = "v2";
export const matchKey = (name: string, lightNovel: boolean, exactOnly: boolean) =>
  createHash("sha256")
    .update(
      `${MATCH_KEY_VERSION}|${lightNovel ? "novel" : "manga"}${exactOnly ? "!" : ""}:${name.toLowerCase()}`,
    )
    .digest("hex");
