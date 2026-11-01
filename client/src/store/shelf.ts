// The signed-in shelf and what's new for it. Kept here rather than in the page
// so coming back to the shelf shows it straight away, with no loading screen,
// and the release check carries on while they're on other pages.
import { create } from "zustand";
import { apiFetch } from "../lib/api";
import {
  getReleases,
  RELEASE_CHECK_TIMEOUT_MS,
  saveSeen,
  type SeenKind,
} from "../lib/shelf";
import type { Manga, ReleaseStatus } from "../lib/types";

type ShelfState = {
  manga: Manga[] | null;
  loadFailed: boolean;
  // null: we couldn't find out for that title
  releases: Record<number, ReleaseStatus | null>;
  load: () => Promise<void>;
  checkReleases: () => Promise<void>;
  // forget the answers and check every title again
  recheckReleases: () => void;
  // "Seen it", or its undo: off the New tab at once, back if the save fails.
  // Says whether it saved
  markSeen: (id: number, kind: SeenKind, number: number | null) => Promise<boolean>;
  // it's been deleted: gone at once, not after the next refresh
  remove: (id: number) => void;
  // on signing in or out: it's someone else's shelf now
  reset: () => void;
};

// where each kind of "Seen it" lives on a manga, and the flag it switches off
const SEEN = {
  volume: { field: "seenVolume", flag: "hasNewVolume", latest: "latestVolume" },
  chapter: { field: "seenChapter", flag: "hasNewChapter", latest: "latestChapter" },
  japan: {
    field: "seenJapanVolume",
    flag: "hasNewJapaneseVolume",
    latest: "latestJapaneseVolume",
  },
} as const;

// the run in progress; only ever one, and resetting stops it
let run: AbortController | null = null;
// bumped on reset, so a shelf still on its way can't come back afterwards
let generation = 0;
// a source didn't answer for these. A slow answer finishes on the server and is
// saved, so they get one more try after the rest, and again on the next visit
const incomplete = new Set<number>();
const retried = new Set<number>();

// one title, given up on after a while so one stuck title can't stop the rest.
// A plain timer: AbortSignal.any doesn't exist before iOS 17.4
const askAbout = async (id: number, stop: AbortSignal) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), RELEASE_CHECK_TIMEOUT_MS);
  const abort = () => controller.abort();
  stop.addEventListener("abort", abort, { once: true });
  try {
    return await getReleases(id, controller.signal);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
    stop.removeEventListener("abort", abort);
  }
};

export const useShelf = create<ShelfState>()((set, get) => ({
  manga: null,
  loadFailed: false,
  releases: {},

  // refreshes in the background: whatever's on screen stays until this answers
  load: async () => {
    const asked = generation;
    retried.clear();
    try {
      const res = await apiFetch("/api/manga");
      if (!res.ok) throw new Error(res.statusText);
      const { manga } = (await res.json()) as { manga: Manga[] };
      if (asked !== generation) return;

      // an answer depends on the title, what they own and where they've read
      // to, so a title edited since it was checked needs checking again
      const { manga: before, releases } = get();
      const stillGood = { ...releases };
      for (const m of manga) {
        const old = before?.find((b) => b.id === m.id);
        if (
          old &&
          (old.name !== m.name ||
            old.volumesOwned !== m.volumesOwned ||
            old.bookmark !== m.bookmark)
        ) {
          delete stillGood[m.id];
          incomplete.delete(m.id);
        }
      }
      set({ manga, releases: stillGood, loadFailed: false });
    } catch {
      // a failed refresh is only a problem if there's nothing to show
      if (asked === generation && !get().manga) set({ loadFailed: true });
    }
  },

  // one title at a time, since the server has to ask other sites about each one
  // it hasn't seen lately
  checkReleases: async () => {
    if (run) return;
    const controller = new AbortController();
    run = controller;
    try {
      while (!controller.signal.aborted) {
        const { manga, releases } = get();
        const next =
          manga?.find((m) => !(m.id in releases)) ??
          manga?.find((m) => incomplete.has(m.id) && !retried.has(m.id));
        if (!next) break;
        const isRetry = next.id in releases;
        if (isRetry) retried.add(next.id);

        const found = await askAbout(next.id, controller.signal);
        if (controller.signal.aborted) return;

        if (found?.complete) incomplete.delete(next.id);
        else incomplete.add(next.id);
        // a retry that got nothing shouldn't wipe what the first try found
        if (isRetry && !found?.releaseStatus) continue;
        set((state) => ({
          releases: {
            ...state.releases,
            [next.id]: found?.releaseStatus ?? null,
          },
        }));
      }
    } finally {
      if (run === controller) run = null;
    }
  },

  recheckReleases: () => {
    incomplete.clear();
    retried.clear();
    set({ releases: {} });
  },

  markSeen: async (id, kind, number) => {
    const { field, flag, latest } = SEEN[kind];
    const apply = (seen: number | null, isNew: boolean) =>
      set((state) => {
        const release = state.releases[id];
        return {
          manga:
            state.manga?.map((m) => (m.id === id ? { ...m, [field]: seen } : m)) ??
            null,
          releases: release
            ? { ...state.releases, [id]: { ...release, [flag]: isNew } }
            : state.releases,
        };
      });
    const before = get();
    const previous = before.manga?.find((m) => m.id === id)?.[field] ?? null;
    const wasNew = before.releases[id]?.[flag] ?? false;
    // still new if what's seen falls short of the latest
    const newest = before.releases[id]?.[latest] ?? 0;
    apply(number, newest > (number ?? 0));
    try {
      await saveSeen(id, kind, number);
      return true;
    } catch {
      apply(previous, wasNew);
      return false;
    }
  },

  remove: (id) => {
    incomplete.delete(id);
    set((state) => {
      const releases = { ...state.releases };
      delete releases[id];
      return {
        manga: state.manga?.filter((m) => m.id !== id) ?? null,
        releases,
      };
    });
  },

  reset: () => {
    run?.abort();
    run = null;
    generation++;
    incomplete.clear();
    retried.clear();
    set({ manga: null, loadFailed: false, releases: {} });
  },
}));
