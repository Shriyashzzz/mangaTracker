// How a visitor looks at a shared shelf: its three sections, the orders it
// can be put in, and compact rows or covers (kept on their device).
import { readLocal } from "../../lib/prefs";
import { ownedCountOf, type SharedManga } from "./shareParts";

export const SECTIONS = ["Reading", "Finished", "To read"] as const;

export const SORTS = {
  name: {
    label: "A–Z",
    order: (a: SharedManga, b: SharedManga) => a.name.localeCompare(b.name),
  },
  rating: {
    label: "Rating",
    order: (a: SharedManga, b: SharedManga) =>
      (b.rating ?? 0) - (a.rating ?? 0) || a.name.localeCompare(b.name),
  },
  volumes: {
    label: "Most volumes",
    order: (a: SharedManga, b: SharedManga) =>
      ownedCountOf(b) - ownedCountOf(a) || a.name.localeCompare(b.name),
  },
} as const;
export type Sort = keyof typeof SORTS;

// compact rows unless this visitor picked covers; kept on their device, apart
// from how their own shelf is laid out
export type View = "rows" | "covers";
export const VIEWS: Record<View, string> = {
  rows: "Compact",
  covers: "Covers",
};
export const viewNow = (): View =>
  readLocal("shareView") === "covers" ? "covers" : "rows";

// on phones only the first list starts open, so the others are a tap away
// rather than a long scroll
export const narrow = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(max-width: 720px)").matches;

export const plural = (n: number, one: string, many = `${one}s`) =>
  `${n} ${n === 1 ? one : many}`;
