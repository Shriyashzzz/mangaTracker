// How close a typed name is to a series' name, give or take slips of the
// finger. The server's copy of client/src/lib/nearMatches.ts (the server is
// built and deployed on its own, so it can't import it);
// tests/shelf/spelling.test.ts fails if the two ever answer differently.

const wordsOf = (text: string) =>
  text
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);

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

// one slip, two in a long word
const allowed = (typed: string) => (typed.length >= 7 ? 2 : 1);

// every word typed is one of the name's, give or take a slip
export function closeEnough(typed: string, name: string) {
  const words = wordsOf(name);
  return wordsOf(typed).every((word) =>
    words.some((w) => slipsBetween(word, w) <= allowed(word)),
  );
}

// how many slips the typed words are from the name's, word by word: the
// closest name comes first
export function slipsInName(typed: string, name: string) {
  const words = wordsOf(name);
  return wordsOf(typed).reduce(
    (sum, word) => sum + Math.min(...words.map((w) => slipsBetween(word, w))),
    0,
  );
}
