// A shared shelf beside the visitor's own: which of its series they have
// too. Two shelf entries are the same series when their names match as the
// shelf itself matches them (lib/titleKey.ts) and both are, or neither is,
// the light novel. Pure.
import { titleKey } from "../../lib/titleKey";

type Entry = { name: string; lightNovel?: boolean };

const keyOf = (m: Entry) =>
  `${titleKey(m.name)}|${m.lightNovel ? "novel" : ""}`;

// a test for "is this series on my shelf?", from the visitor's shelf
export function onMyShelf(mine: Entry[]) {
  const keys = new Set(mine.map(keyOf));
  return (m: Entry) => keys.has(keyOf(m));
}
