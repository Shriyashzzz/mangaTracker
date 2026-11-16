// A search box's answer to a typo, the same everywhere: a title that finds
// nothing is searched again by its words, longest first ("one peice" by
// "peice", then "one"), and a series found that way counts only when every
// word they typed is a word of its name, give or take a slip of the finger
// (closeEnough). So "one peice" finds One Piece and "vinland sga" Vinland
// Saga, while "zzqqxx nothing" finds nothing. What's found is a guess, said
// as one ("Did you mean"), and never picked for them. Used by the add page
// and every series search (Prices, the import's match box, a scan's edit).

// said over guesses, wherever a search shows them
export const DID_YOU_MEAN = "Nothing by that name. Did you mean one of these?";

const wordsOf = (text: string) =>
  text
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);

// three tries at most
export const wordsToTry = (query: string) =>
  [...new Set(wordsOf(query))]
    .filter((word) => word.length >= 3 && word !== query.toLowerCase())
    .sort((a, b) => b.length - a.length)
    .slice(0, 3);

// how many slips of the finger apart two words are: a letter missing, one
// too many, one wrong, or two side by side swapped ("peice", "piece")
export function slipsBetween(a: string, b: string) {
  const rows = Array.from({ length: a.length + 1 }, (_, i) =>
    Array.from({ length: b.length + 1 }, (_, j) =>
      i === 0 ? j : j === 0 ? i : 0,
    ),
  );
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++) {
      const changed = a[i - 1] === b[j - 1] ? 0 : 1;
      let best = Math.min(
        rows[i - 1]![j]! + 1,
        rows[i]![j - 1]! + 1,
        rows[i - 1]![j - 1]! + changed,
      );
      const swapped =
        i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1];
      if (swapped) best = Math.min(best, rows[i - 2]![j - 2]! + 1);
      rows[i]![j] = best;
    }
  return rows[a.length]![b.length]!;
}

// a word they typed is in the name, or near enough: one slip, two in a long
// word
const nearWord = (typed: string, name: string[]) =>
  name.some((word) => slipsBetween(typed, word) <= (typed.length >= 7 ? 2 : 1));

// every word they typed is one of the name's, give or take a slip
export const closeEnough = (query: string, title: string) => {
  const name = wordsOf(title);
  return wordsOf(query).every((typed) => nearWord(typed, name));
};

// the closest known names searched for, at most
const NAMES_TRIED = 2;

// `search(text, retry)`: a retry is by one word, and should ask for the most
// read first (AniList's closest names for "one" bury One Piece). Last, the
// names the site knows: the closest is searched as if they'd typed it
export async function withNearMatches<T>(
  query: string,
  search: (text: string, retry: boolean) => Promise<T[]>,
  titleOf: (hit: T) => string,
  // the names the site knows near a typo (lib/knownNames.ts); none for a
  // search without them
  knownNear: (text: string) => Promise<string[]> = async () => [],
): Promise<{ hits: T[]; guessed: boolean }> {
  const hits = await search(query, false);
  if (hits.length) return { hits, guessed: false };
  for (const word of wordsToTry(query)) {
    const near = (await search(word, true)).filter((hit) =>
      closeEnough(query, titleOf(hit)),
    );
    if (near.length) return { hits: near, guessed: true };
  }
  const names = await knownNear(query);
  for (const name of names.slice(0, NAMES_TRIED)) {
    const found = (await search(name, false)).filter((hit) =>
      closeEnough(name, titleOf(hit)),
    );
    if (found.length) return { hits: found, guessed: true };
  }
  return { hits: [], guessed: false };
}

// a name worth offering on its own (the import's "Did you mean"): every word
// typed is near one of its words, and every word of it near one typed. "one
// peice" is One Piece; "Dune" isn't "Slam Dunk", whose "Slam" was never typed
export const nearBothWays = (typed: string, name: string) =>
  closeEnough(typed, name) && closeEnough(name, typed);
