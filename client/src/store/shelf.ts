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
  type ReleaseOutcome,
  type SeenKind,
} from "../lib/shelf";
import { releaseChecksOn, writeLocal } from "../lib/prefs";
import type { Manga, ReleaseStatus } from "../lib/types";
import { checkOrder, laneOf } from "../lib/releaseOrder";

type ShelfState = {
  manga: Manga[] | null;
  loadFailed: boolean;
  // null: nothing to say for that title (outcomes says why)
  releases: Record<number, ReleaseStatus | null>;
  // what each title's check came to: "failed" when the sites didn't answer,
  // so "Couldn't check right now" is only said when that's what happened
  outcomes: Record<number, ReleaseOutcome>;
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
  // several deleted at once with the shelf's Select, all or none. Says
  // whether it worked; on success their undo is on offer
  removeMany: (ids: number[]) => Promise<boolean>;
  // the last ones deleted (one, or a Select's), while their undo is on offer
  lastDeleted: Manga[] | null;
  setLastDeleted: (manga: Manga | Manga[] | null) => void;
  // puts them back as they were, unless they've been added again since
  // "partial": some came back, the rest couldn't (count in `lostOnUndo`)
  undoDelete: () => Promise<"done" | "already-back" | "partial" | "failed">;
  // how many the last undo couldn't bring back (the server turned them away)
  lostOnUndo: number;
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

// a Select's undo sends this many series a request
const RESTORE_PIECE = 200;
// what the undo needs of a series, and nothing else (ids, dates, prices)
const restorable = (m: Manga) => ({
  // within the limits restore checks, which older rows may be past
  name: m.name.slice(0, 150),
  status: m.status,
  planned: m.planned,
  lightNovel: m.lightNovel,
  bookmark: m.bookmark,
  volumesOwned: m.volumesOwned,
  ownedList: m.ownedList,
  genre: m.genre,
  description: m.description?.slice(0, 450) ?? null,
  image: m.image,
  rating: m.rating,
  seenVolume: m.seenVolume,
  seenChapter: m.seenChapter,
  seenJapanVolume: m.seenJapanVolume,
  hiddenVolumes: m.hiddenVolumes,
  latestChapter: m.latestChapter,
});

export const useShelf = create<ShelfState>()((set, get) => ({
  manga: null,
  loadFailed: false,
  releases: {},
  outcomes: {},
  lastDeleted: null,
  lostOnUndo: 0,
  setLastDeleted: (manga) =>
    set({ lastDeleted: manga && (Array.isArray(manga) ? manga : [manga]) }),
  undoDelete: async () => {
    const { lastDeleted, load } = get();
    if (!lastDeleted?.length) return "failed";
    set({ lostOnUndo: 0 });
    if (lastDeleted.length === 1) {
      try {
        const res = await apiFetch("/api/manga/restore", {
          method: "POST",
          body: restorable(lastDeleted[0]!),
        });
        if (res.status === 409) return "already-back";
        if (!res.ok) throw new Error(res.statusText);
      } catch {
        return "failed";
      }
      await load();
      set({ lastDeleted: null });
      return "done";
    }
    // in pieces, each well under the server's request size limit. A piece
    // that's back comes off the list, so trying again carries on from there
    let restored = 0;
    let lost = 0;
    try {
      let left = lastDeleted;
      while (left.length) {
        const piece = left.slice(0, RESTORE_PIECE);
        const res = await apiFetch("/api/manga/restore-many", {
          method: "POST",
          body: { manga: piece.map(restorable) },
        });
        if (!res.ok) throw new Error(res.statusText);
        const answer = (await res.json()) as {
          restored: number;
          invalid: number;
        };
        restored += answer.restored;
        lost += answer.invalid;
        left = left.slice(RESTORE_PIECE);
        set({ lastDeleted: left.length ? left : null });
      }
    } catch {
      // what did come back shows, and the rest waits for another try
      if (restored) await load();
      return "failed";
    }
    await load();
    set({ lastDeleted: null, lostOnUndo: lost });
    if (lost) return "partial";
    return restored ? "done" : "already-back";
  },

  removeMany: async (ids) => {
    const gone = new Set(ids);
    // as the server has them now, so the undo puts back what's really there
    // (a newer chapter, an edit in another tab), not what this page last saw
    let deleted = get().manga?.filter((m) => gone.has(m.id)) ?? [];
    try {
      const res = await apiFetch("/api/manga");
      if (res.ok) {
        const { manga } = (await res.json()) as { manga: Manga[] };
        deleted = manga.filter((m) => gone.has(m.id));
      }
    } catch {
      // the page's copy will have to do
    }
    try {
      const res = await apiFetch("/api/manga/delete-many", {
        method: "POST",
        body: { ids },
      });
      if (!res.ok) throw new Error(res.statusText);
    } catch {
      return false;
    }
    // off the page in one go, not one update per series
    for (const id of ids) incomplete.delete(id);
    set((state) => {
      const releases = { ...state.releases };
      const outcomes = { ...state.outcomes };
      for (const id of ids) {
        delete releases[id];
        delete outcomes[id];
      }
      return {
        manga: state.manga?.filter((m) => !gone.has(m.id)) ?? null,
        releases,
        outcomes,
        lastDeleted: deleted.length ? deleted : null,
      };
    });
    return true;
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
      const { manga: before, releases, outcomes } = get();
      const stillGood = { ...releases };
      const stillKnown = { ...outcomes };
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
          delete stillKnown[m.id];
          incomplete.delete(m.id);
        }
      }
      set({
        manga,
        releases: stillGood,
        outcomes: stillKnown,
        loadFailed: false,
      });
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
    // sorted once a run, and again only if the shelf itself changes (a 2000
    // series shelf shouldn't be re-sorted before every check)
    let sortedFor: Manga[] | null = null;
    let ordered: Manga[] = [];
    try {
      while (!controller.signal.aborted && releaseChecksOn()) {
        const { manga, releases } = get();
        if (manga !== sortedFor) {
          sortedFor = manga;
          ordered = checkOrder(manga ?? []);
        }
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
        // no answer at all (timed out, offline) is a failure too; a server
        // from before outcomes says only whether it's worth asking again
        const outcome: ReleaseOutcome = !found
          ? "failed"
          : (found.outcome ??
            (found.releaseStatus
              ? "news"
              : found.complete
                ? "notFound"
                : "failed"));
        set((state) => ({
          releases: {
            ...state.releases,
            [next.id]: found?.releaseStatus ?? null,
          },
          outcomes: { ...state.outcomes, [next.id]: outcome },
        }));
      }
    } finally {
      if (run === controller) run = null;
    }
  },

  recheckReleases: () => {
    incomplete.clear();
    retried.clear();
    set({ releases: {}, outcomes: {} });
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
      const outcomes = { ...state.outcomes };
      delete outcomes[id];
      return {
        manga: state.manga?.filter((m) => m.id !== id) ?? null,
        releases,
        outcomes,
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
    set({
      manga: null,
      loadFailed: false,
      releases: {},
      outcomes: {},
      lastDeleted: null,
    });
  },
}));
