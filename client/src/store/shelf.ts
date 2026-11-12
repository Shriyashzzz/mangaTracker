// The signed-in shelf and what's new for it. Kept here rather than in the page
// so coming back to the shelf shows it straight away, with no loading screen,
// and the release check carries on while they're on other pages.
import { create } from "zustand";
import { apiFetch } from "../lib/api";
import {
  getReleases,
  getSavedReleases,
  LAST_NEW_COUNT_KEY,
  RELEASE_CHECK_TIMEOUT_MS,
  saveSeen,
} from "../lib/shelf";
import {
  isStillNew,
  type ReleaseOutcome,
  type SeenKind,
} from "../lib/releaseMath";
import { releaseChecksOn, writeLocal } from "../lib/prefs";
import type { Manga, ReleaseStatus } from "../lib/types";
import { checkOrder, laneOf } from "../lib/releaseOrder";
import {
  clearAnswers,
  loadAnswers,
  mergeSaved,
  saveAnswers,
  seriesKey,
  STALE_MS,
} from "../lib/releaseCache";

type ShelfState = {
  manga: Manga[] | null;
  loadFailed: boolean;
  // null: nothing to say for that title (outcomes says why)
  releases: Record<number, ReleaseStatus | null>;
  // what each title's check came to: "failed" when the sites didn't answer,
  // so "Couldn't check right now" is only said when that's what happened
  outcomes: Record<number, ReleaseOutcome>;
  // when each answer was checked (kept between visits: lib/releaseCache.ts)
  checkedAt: Record<number, number>;
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
  // it's been deleted (or they have): gone at once, not after the next refresh
  remove: (ids: number | number[]) => void;
  // several deleted at once with the shelf's Select, all or none. Says
  // whether it worked; on success their undo is on offer
  removeMany: (ids: number[]) => Promise<boolean>;
  // Select's Move to: several to Finished, To read or Reading at once. Gives
  // where each was, for the undo; null if it didn't save
  moveMany: (ids: number[], to: ShelfMove) => Promise<ShelfPlace[] | null>;
  // that undo: each back where it was. Says whether it all saved
  placeMany: (places: ShelfPlace[]) => Promise<boolean>;
  // the last ones deleted (one, or a Select's), while their undo is on offer
  lastDeleted: Manga[] | null;
  setLastDeleted: (manga: Manga | Manga[] | null) => void;
  // puts them back as they were, unless they've been added again since
  undoDelete: () => Promise<void>;
  // an undo is under way: the note doesn't time out from under it
  undoing: boolean;
  // how the last undo went, when there's something to say ("3 of them
  // couldn't come back"). Gone with the next delete
  undoMessage: string;
  clearUndoMessage: () => void;
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
// answers from an earlier visit that are getting old: shown, and checked
// again quietly once everything else is
const stale = new Set<number>();
// the server's saved answers are asked for once a visit, before the first check
let savedAsked = false;
// answers that came from this browser's own store, and the release settings
// they were found with; the server's batch says what the settings are now
const fromBrowser = new Set<number>();
let keptSettings: string | null = null;
let settingsNow: string | null = null;
// Check again and signing out start a new round: an answer from the old one,
// still on its way, is dropped
let round = 0;

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
// the move's undo goes back in pieces this big (the server takes 2000)
const PLACE_PIECE = 2000;

export type ShelfMove = "finished" | "planned" | "reading";
export type ShelfPlace = Pick<Manga, "id" | "status" | "planned" | "bookmark">;
// what the undo needs of a series, and nothing else (ids, dates, prices)
const restorable = (m: Manga) => ({
  // within the limits restore checks, which older rows may be past
  name: m.name.slice(0, 150),
  status: m.status,
  planned: m.planned,
  lightNovel: m.lightNovel,
  bookmark: m.bookmark,
  byVolume: m.byVolume,
  readVolume: m.readVolume,
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
  checkedAt: {},
  lastDeleted: null,
  undoing: false,
  undoMessage: "",
  clearUndoMessage: () => set({ undoMessage: "" }),
  setLastDeleted: (manga) =>
    set({
      lastDeleted: manga && (Array.isArray(manga) ? manga : [manga]),
      ...(manga ? { undoMessage: "" } : {}),
    }),
  undoDelete: async () => {
    const { lastDeleted, load } = get();
    if (!lastDeleted?.length || get().undoing) return;
    const one = lastDeleted.length === 1;
    set({ undoing: true, undoMessage: "" });
    const said = (undoMessage: string) => set({ undoing: false, undoMessage });
    if (one) {
      try {
        const res = await apiFetch("/api/manga/restore", {
          method: "POST",
          body: restorable(lastDeleted[0]!),
        });
        if (res.status === 409) {
          set({ lastDeleted: null });
          return said("It's already back on your shelf.");
        }
        if (!res.ok) throw new Error(res.statusText);
      } catch {
        return said("That didn't bring it back. Try again.");
      }
      await load();
      set({ lastDeleted: null });
      return said("");
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
      return said("That didn't bring them all back. Try again.");
    }
    await load();
    set({ lastDeleted: null });
    said(
      lost
        ? `${lost} of them couldn't come back. The rest are on your shelf.`
        : restored
          ? ""
          : "They're already back on your shelf.",
    );
  },

  removeMany: async (ids) => {
    let deleted: Manga[];
    try {
      const res = await apiFetch("/api/manga/delete-many", {
        method: "POST",
        body: { ids },
      });
      if (!res.ok) throw new Error(res.statusText);
      // exactly what went, as the server had it: what the undo puts back
      deleted = ((await res.json()) as { manga: Manga[] }).manga;
    } catch {
      return false;
    }
    get().remove(ids);
    set({
      lastDeleted: deleted.length ? deleted : null,
      undoMessage: "",
    });
    return true;
  },

  moveMany: async (ids, to) => {
    let was: ShelfPlace[];
    try {
      const res = await apiFetch("/api/manga/move-many", {
        method: "POST",
        body: { ids, to },
      });
      if (!res.ok) throw new Error(res.statusText);
      was = ((await res.json()) as { was: ShelfPlace[] }).was;
    } catch {
      return null;
    }
    // as the server did it: Reading puts one that hadn't started at chapter 1
    const moving = new Set(was.map((p) => p.id));
    set((state) => ({
      manga:
        state.manga?.map((m) =>
          !moving.has(m.id)
            ? m
            : to === "finished"
              ? { ...m, status: true, planned: false }
              : to === "planned"
                ? { ...m, planned: true, status: false }
                : {
                    ...m,
                    status: false,
                    planned: false,
                    bookmark: m.planned && m.bookmark == null ? 1 : m.bookmark,
                  },
        ) ?? null,
    }));
    return was;
  },

  placeMany: async (places) => {
    let ok = true;
    for (let i = 0; i < places.length; i += PLACE_PIECE) {
      const piece = places.slice(i, i + PLACE_PIECE);
      try {
        const res = await apiFetch("/api/manga/place-many", {
          method: "POST",
          body: { places: piece },
        });
        if (!res.ok) throw new Error(res.statusText);
      } catch {
        ok = false;
        continue;
      }
      const back = new Map(piece.map((p) => [p.id, p]));
      set((state) => ({
        manga:
          state.manga?.map((m) => {
            const p = back.get(m.id);
            return p ? { ...m, ...p } : m;
          }) ?? null,
      }));
    }
    return ok;
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

      // an answer depends on the title, what they own, where they've read to
      // and what they've hidden (maybe on another device), so a series
      // changed since it was checked needs checking again
      const { manga: before, releases, outcomes } = get();
      const stillGood = { ...releases };
      const stillKnown = { ...outcomes };
      for (const m of manga) {
        const old = before?.find((b) => b.id === m.id);
        if (old && seriesKey(old) !== seriesKey(m)) {
          delete stillGood[m.id];
          delete stillKnown[m.id];
          incomplete.delete(m.id);
        }
      }
      // the first time this visit: what the last visit found, straight away
      let checkedAt = get().checkedAt;
      if (!before) {
        const kept = loadAnswers(manga);
        keptSettings = kept.settings;
        const now = Date.now();
        for (const id of Object.keys(kept.releases).map(Number)) {
          if (id in stillGood) continue;
          fromBrowser.add(id);
          stillGood[id] = kept.releases[id]!;
          stillKnown[id] = kept.outcomes[id]!;
          if (now - kept.checkedAt[id]! > STALE_MS) stale.add(id);
        }
        checkedAt = { ...kept.checkedAt, ...checkedAt };
      }
      set({
        manga,
        releases: stillGood,
        outcomes: stillKnown,
        checkedAt,
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
      // first, every answer the server still stands by, in one request: on a
      // shelf checked lately that's all of it
      if (!savedAsked) {
        savedAsked = true;
        const asked = round;
        const saved = await getSavedReleases(controller.signal).catch(
          () => null,
        );
        if (controller.signal.aborted || asked !== round) return;
        if (saved) {
          const now = Date.now();
          if (saved.settings) settingsNow = saved.settings;
          // their settings changed elsewhere: what this browser kept may say
          // the wrong thing, so it's checked again (the server's own answers
          // already match the settings as they are)
          const settingsChanged =
            keptSettings !== null &&
            saved.settings !== undefined &&
            saved.settings !== keptSettings;
          set((state) => {
            if (settingsChanged) {
              const releases = { ...state.releases };
              const outcomes = { ...state.outcomes };
              for (const id of fromBrowser) {
                if (id in saved.answers) continue;
                delete releases[id];
                delete outcomes[id];
                stale.delete(id);
              }
              state = { ...state, releases, outcomes };
            }
            const merged = mergeSaved(state, saved.answers, now);
            for (const id of merged.fresh) stale.delete(id);
            return merged.state;
          });
        }
      }
      while (!controller.signal.aborted && releaseChecksOn()) {
        const { manga, releases } = get();
        if (manga !== sortedFor) {
          sortedFor = manga;
          ordered = checkOrder(manga ?? []);
        }
        const next =
          ordered.find((m) => !(m.id in releases)) ??
          ordered.find((m) => incomplete.has(m.id) && !retried.has(m.id)) ??
          // last, the old answers, checked again quietly: they're on show
          // already, so nothing on the page waits for these
          ordered.find((m) => stale.has(m.id));
        if (!next) break;
        const quiet = stale.delete(next.id);
        const isRetry = !quiet && next.id in releases;
        if (isRetry) retried.add(next.id);
        const found = await askAbout(next, controller.signal);
        if (controller.signal.aborted) return;
        // the series changed while it was being asked about (edited, read on,
        // hidden): the answer is for how it was, so it's asked again
        const now = get().manga?.find((m) => m.id === next.id);
        if (!now || seriesKey(now) !== seriesKey(next)) continue;
        // an old answer stays until a new one actually comes
        if (quiet && (!found || found.outcome === "failed")) continue;

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
          checkedAt: { ...state.checkedAt, [next.id]: Date.now() },
        }));
      }
    } finally {
      if (run === controller) run = null;
    }
  },

  // everything asked again from the sites, nothing kept used
  recheckReleases: () => {
    run?.abort();
    run = null;
    round++;
    fromBrowser.clear();
    incomplete.clear();
    retried.clear();
    stale.clear();
    savedAsked = true;
    clearAnswers();
    set({ releases: {}, outcomes: {}, checkedAt: {} });
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

  // in one update however many: a Select can take a whole shelf
  remove: (ids) => {
    const gone = new Set(Array.isArray(ids) ? ids : [ids]);
    for (const id of gone) incomplete.delete(id);
    set((state) => {
      const releases = { ...state.releases };
      const outcomes = { ...state.outcomes };
      for (const id of gone) {
        delete releases[id];
        delete outcomes[id];
      }
      return {
        manga: state.manga?.filter((m) => !gone.has(m.id)) ?? null,
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
    stale.clear();
    savedAsked = false;
    round++;
    fromBrowser.clear();
    keptSettings = null;
    settingsNow = null;
    // another account's answers never show here
    clearAnswers();
    writeLocal(LAST_NEW_COUNT_KEY, "");
    set({
      manga: null,
      loadFailed: false,
      releases: {},
      outcomes: {},
      checkedAt: {},
      lastDeleted: null,
      undoing: false,
      undoMessage: "",
    });
  },
}));

// the answers kept for the next visit as they change, a moment after the last
// change (a check answers one series at a time)
let saveTimer: ReturnType<typeof setTimeout> | undefined;
useShelf.subscribe((state, prev) => {
  if (
    state.releases === prev.releases &&
    state.outcomes === prev.outcomes &&
    state.manga === prev.manga
  )
    return;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    const { manga, releases, outcomes, checkedAt } = useShelf.getState();
    if (manga)
      saveAnswers(
        manga,
        releases,
        outcomes,
        checkedAt,
        incomplete,
        settingsNow ?? keptSettings,
      );
  }, 2500);
});
