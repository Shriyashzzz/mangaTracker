// The New tab's piles: a big list of what's new, sorted by what to do about
// it. "Just out" is the one newest release that came out lately, the rest by
// how far behind they are. Each pile has its own page (?pile=way), as does
// the whole list (?pile=all). The hidden list sorts the same way
import type { Manga, ReleaseStatus } from "../../lib/types";
import type { ReleaseKind, Releases } from "./shelfViews";

export const PILES = ["just-out", "one", "few", "way"] as const;
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
    "just-out": {
      name: "Just out",
      why: "The next volume came out in the last month",
    },
    one: { name: "One to get", why: "The next volume is the newest" },
    few: { name: "A few behind", why: "2 to 5 volumes" },
    way: { name: "Way behind", why: "6 or more" },
  },
  chapters: {
    "just-out": {
      name: "Just out",
      why: "The next chapter came out in the last week",
    },
    one: { name: "One to read", why: "The next chapter is the newest" },
    few: { name: "A few to read", why: "2 to 10 chapters" },
    way: { name: "Way behind", why: "More than 10" },
  },
  japan: {
    "just-out": {
      name: "Just out in Japan",
      why: "Came out there in the last month",
    },
    one: { name: "One ahead", why: "Japan has one more" },
    few: { name: "A few ahead", why: "2 to 5 volumes" },
    way: { name: "Way ahead", why: "6 or more" },
  },
};

// "a few" goes up to this many; chapters come faster than volumes
const FEW: Record<ReleaseKind, number> = { volumes: 5, chapters: 10, japan: 5 };
// how lately "just out" means
const FRESH_DAYS: Record<ReleaseKind, number> = {
  volumes: 31,
  chapters: 7,
  japan: 31,
};
const DAY = 24 * 60 * 60 * 1000;

// how many are out past where they are (at least the one that put it here)
export function behindOf(
  found: ReleaseStatus | null | undefined,
  kind: ReleaseKind,
) {
  if (!found) return 1;
  if (kind === "japan") return Math.max(1, found.outJapanVolumes.length);
  if (kind === "chapters")
    return found.latestChapter != null && found.nextChapter != null
      ? Math.max(1, Math.floor(found.latestChapter) - found.nextChapter + 1)
      : 1;
  return Math.max(1, found.outVolumes.length);
}

const dateOf = (found: ReleaseStatus, kind: ReleaseKind) =>
  kind === "volumes"
    ? found.latestVolumeDate
    : kind === "chapters"
      ? found.latestChapterDate
      : found.latestJapaneseVolumeDate;

export function pileOf(
  found: ReleaseStatus | null | undefined,
  kind: ReleaseKind,
  now = Date.now(),
): Pile {
  const behind = behindOf(found, kind);
  if (behind <= 1) {
    // "2026-11" counts from the 1st; no date, and it can't be called fresh
    const out = found ? Date.parse(dateOf(found, kind) ?? "") : NaN;
    const age = now - out;
    return age >= -DAY && age <= FRESH_DAYS[kind] * DAY ? "just-out" : "one";
  }
  return behind <= FEW[kind] ? "few" : "way";
}

// what a pile's line says after what it is: how much there is to catch up
// on, for the piles where that's more than one each ("· 112 to catch up")
export function catchUpText(
  pile: Pile,
  list: Manga[],
  releases: Releases,
  kind: ReleaseKind,
) {
  if (pile !== "few" && pile !== "way") return "";
  const total = list.reduce((n, m) => n + behindOf(releases[m.id], kind), 0);
  return ` · ${total.toLocaleString("en-US")} to catch up`;
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
  now = Date.now(),
) {
  const piles: Record<Pile, Manga[]> = {
    "just-out": [],
    one: [],
    few: [],
    way: [],
  };
  for (const m of list) piles[pileOf(releases[m.id], kind, now)].push(m);
  return piles;
}
