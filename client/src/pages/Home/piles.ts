// The New tab's piles: a big list of what's new, sorted by how far behind
// the reader is: one, a few, or a lot. Each pile has its own page
// (?pile=way), as does the whole list (?pile=all). The hidden list sorts
// the same way
import { behindOf } from "../../lib/releaseMath";
import type { Manga, ReleaseStatus } from "../../lib/types";
import type { ReleaseKind, Releases } from "./shelfViews";

// how many are out past where they are: lib/releaseMath.ts has it, as the
// badge's count needs it too
export { behindOf };

export const PILES = ["one", "few", "way"] as const;
export type Pile = (typeof PILES)[number];
// what ?pile= can ask for: a pile, or everything in one list
export type PileView = Pile | "all";
export const isPileView = (value: string | null): value is PileView =>
  value === "all" || PILES.includes(value as Pile);

// fewer new series than this and the plain list is short enough as it is
export const PILES_FROM = 12;

export const PILE_TEXT: Record<
  ReleaseKind,
  Record<Pile, { name: string; why: string }>
> = {
  volumes: {
    one: { name: "Next for you", why: "The next volume is the newest" },
    few: { name: "A few behind", why: "You're 2 to 5 volumes behind" },
    // gently: on day one every series just added lands here
    way: { name: "Long reads ahead", why: "6 or more volumes still to read" },
  },
  chapters: {
    one: { name: "One to read", why: "The next chapter is the newest" },
    few: { name: "A few to read", why: "You're 2 to 10 chapters behind" },
    way: { name: "Long reads ahead", why: "11 or more chapters still to read" },
  },
  japan: {
    one: { name: "One ahead", why: "Japan has one more" },
    few: { name: "A few ahead", why: "Japan is 2 to 5 volumes ahead" },
    way: { name: "Way ahead", why: "Japan is 6 or more volumes ahead" },
  },
};

// "a few" goes up to this many; chapters come faster than volumes
const FEW: Record<ReleaseKind, number> = { volumes: 5, chapters: 10, japan: 5 };

// How many behind they are, as every card, stamp and pile says it: every
// volume that's out and isn't theirs, the newest included. Owning vol. 28
// with 29 and 30 out is 2 behind. One behind is just the newest having come
// out: that's news ("Next for you"), so nothing calls it behind
export const volumesBehind = (
  found: ReleaseStatus | null | undefined,
  kind: ReleaseKind,
) => {
  const behind = behindOf(found, kind);
  return behind > 1 ? behind : 0;
};

export function pileOf(
  found: ReleaseStatus | null | undefined,
  kind: ReleaseKind,
): Pile {
  const behind = behindOf(found, kind);
  if (behind <= 1) return "one";
  return behind <= FEW[kind] ? "few" : "way";
}

// what a pile's line says after what it is: how much there is to catch up
// on, for the piles where that's more than one each ("· 12 to catch up",
// and for Long reads ahead, gently, "· 112 in all")
export function catchUpText(
  pile: Pile,
  list: Manga[],
  releases: Releases,
  kind: ReleaseKind,
) {
  if (pile !== "few" && pile !== "way") return "";
  const total = list.reduce((n, m) => n + behindOf(releases[m.id], kind), 0);
  const words = pile === "way" ? "in all" : "to catch up";
  return ` · ${total.toLocaleString("en-US")} ${words}`;
}

// how a pile's own page can be ordered: as the shelf lists it, most or least
// to catch up on first, or by title
export const PILE_SORTS = [
  { value: "", label: "Shelf order" },
  { value: "most", label: "Most to catch up" },
  { value: "least", label: "Least to catch up" },
  { value: "az", label: "Title, A to Z" },
] as const;
export type PileSort = (typeof PILE_SORTS)[number]["value"];

export function sortPile(
  list: Manga[],
  releases: Releases,
  kind: ReleaseKind,
  sort: PileSort,
) {
  if (!sort) return list;
  if (sort === "az")
    return [...list].sort((a, b) => a.name.localeCompare(b.name));
  const behind = (m: Manga) => behindOf(releases[m.id], kind);
  return [...list].sort((a, b) =>
    sort === "most" ? behind(b) - behind(a) : behind(a) - behind(b),
  );
}

// the list, pile by pile, each keeping the list's order
export function sortIntoPiles(
  list: Manga[],
  releases: Releases,
  kind: ReleaseKind,
) {
  const piles: Record<Pile, Manga[]> = {
    one: [],
    few: [],
    way: [],
  };
  for (const m of list) piles[pileOf(releases[m.id], kind)].push(m);
  return piles;
}
