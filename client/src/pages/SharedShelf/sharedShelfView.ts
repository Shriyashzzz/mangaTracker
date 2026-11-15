// How a visitor looks at a shared shelf: its tabs (the three reading
// statuses, and what to get next), the orders it can be put in, and compact
// rows or covers (kept on their device).
import { readLocal } from "../../lib/prefs";
import { ownedCountOf, type SharedManga } from "./shareParts";

export const SECTIONS = ["Reading", "Finished", "To read"] as const;
// the tabs: each status, then the next volume to get for each series
export const TABS = [...SECTIONS, "To get"] as const;
export type Tab = (typeof TABS)[number];

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

export const plural = (n: number, one: string, many = `${one}s`) =>
  `${n} ${n === 1 ? one : many}`;
