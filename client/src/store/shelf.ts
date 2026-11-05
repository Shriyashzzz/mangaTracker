// The signed-in shelf and what's new for it. Kept here rather than in the page
// so coming back to the shelf shows it straight away, with no loading screen,
// and the release check carries on while they're on other pages.
import { create } from "zustand";
import { apiFetch } from "../lib/api";
import {
  getReleases,
  isStillNew,
  LAST_NEW_COUNT_KEY,
  RELEASE_CHECK_TIMEOUT_MS,
  saveSeen,
  type SeenKind,
} from "../lib/shelf";
import { releaseChecksOn, writeLocal } from "../lib/prefs";
import type { Manga, ReleaseStatus } from "../lib/types";
import { checkOrder, laneOf } from "../lib/releaseOrder";

type ShelfState = {
  manga: Manga[] | null;
  loadFailed: boolean;
  // null: we couldn't find out for that title
  releases: Record<number, ReleaseStatus | null>;
  load: () => Promise<void>;
  checkReleases: () => Promise<void>;
  // forget the answers and check every title again
  recheckReleases: () => void;
  // "Hide", or its undo: off the New tab at once, back if the save fails.
  // Says whether it saved
  markSeen: (
    id: number,
    kind: SeenKind,
    number: number | null,
    hiddenVolumes?: number[],
  ) => Promise<boolean>;
  // it's been deleted: gone at once, not after the next refresh
  remove: (id: number) => void;
  // the last one deleted, while its undo is on offer
  lastDeleted: Manga | null;
  setLastDeleted: (manga: Manga | null) => void;
  // puts it back as it was, unless it's been added again since
  undoDelete: () => Promise<"done" | "already-back" | "failed">;
  // on signing in or out: it's someone else's shelf now
  reset: () => void;
};

// where each kind of "Hide" lives on a manga, and the flag it switches off
const SEEN = {
  volume: { field: "seenVolume", flag: "hasNewVolume" },
  chapter: { field: "seenChapter", flag: "hasNewChapter" },
  japan: { field: "seenJapanVolume", flag: "hasNewJapaneseVolume" },
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
const askAbout = async (m: Manga, stop: AbortSignal) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), RELEASE_CHECK_TIMEOUT_MS);
  const abort = () => controller.abort();
  stop.addEventListener("abort", abort, { once: true });
  try {
    return await getReleases(m.id, controller.signal, laneOf(m));
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
  lastDeleted: null,
  setLastDeleted: (lastDeleted) => set({ lastDeleted }),
  undoDelete: async () => {
    const { lastDeleted, load } = get();
    if (!lastDeleted) return "failed";
    try {
      const res = await apiFetch("/api/manga/restore", {
        method: "POST",
        body: lastDeleted,
      });
      if (res.status === 409) return "already-back";
      if (!res.ok) throw new Error(res.statusText);
      await load();
      set({ lastDeleted: null });
      return "done";
    } catch {
      return "failed";
    }
  },

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
            old.lightNovel !== m.lightNovel ||
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
  // it hasn't seen lately, most likely news first (lib/releaseOrder.ts)
  checkReleases: async () => {
    if (run || !releaseChecksOn()) return;
    const controller = new AbortController();
    run = controller;
    try {
      while (!controller.signal.aborted && releaseChecksOn()) {
        const { manga, releases } = get();
        const ordered = checkOrder(manga ?? []);
        const next =
          ordered.find((m) => !(m.id in releases)) ??
          ordered.find((m) => incomplete.has(m.id) && !retried.has(m.id));
        if (!next) break;
        const isRetry = next.id in releases;
        if (isRetry) retried.add(next.id);
        const found = await askAbout(next, controller.signal);
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

  markSeen: async (id, kind, number, hiddenVolumes) => {
    const { field, flag } = SEEN[kind];
    const apply = (seen: number | null, hiddenList?: number[]) =>
      set((state) => {
        const manga =
          state.manga?.map((m) =>
            m.id === id
              ? {
                  ...m,
                  [field]: seen,
                  ...(hiddenList ? { hiddenVolumes: hiddenList } : {}),
                }
              : m,
          ) ?? null;
        const release = state.releases[id];
        const changed = manga?.find((m) => m.id === id);
        return {
          manga,
          releases:
            release && changed
              ? {
                  ...state.releases,
                  [id]: {
                    ...release,
                    [flag]: isStillNew(kind, changed, release),
                  },
                }
              : state.releases,
        };
      });
    const before = get().manga?.find((m) => m.id === id);
    const previous = before?.[field] ?? null;
    const previousList = before?.hiddenVolumes ?? [];
    apply(number, hiddenVolumes);
    try {
      await saveSeen(id, kind, number, hiddenVolumes);
      return true;
    } catch {
      apply(previous, hiddenVolumes ? previousList : undefined);
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
    writeLocal(LAST_NEW_COUNT_KEY, "");
    set({ manga: null, loadFailed: false, releases: {}, lastDeleted: null });
  },
}));
