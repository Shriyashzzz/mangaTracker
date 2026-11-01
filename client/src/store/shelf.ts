// The signed-in shelf and what's new for it. Kept here rather than in the page
// so coming back to the shelf shows it straight away, with no loading screen,
// and the release check carries on while they're on other pages.
import { create } from "zustand";
import { apiFetch } from "../lib/api";
import { getReleases, RELEASE_CHECK_TIMEOUT_MS } from "../lib/shelf";
import type { Manga, ReleaseStatus } from "../lib/types";

type ShelfState = {
  manga: Manga[] | null;
  loadFailed: boolean;
  // null: we couldn't find out for that title
  releases: Record<number, ReleaseStatus | null>;
  load: () => Promise<void>;
  checkReleases: () => Promise<void>;
  // on signing in or out: it's someone else's shelf now
  reset: () => void;
};

// the run in progress; only ever one, and resetting stops it
let run: AbortController | null = null;

export const useShelf = create<ShelfState>()((set, get) => ({
  manga: null,
  loadFailed: false,
  releases: {},

  // refreshes in the background: whatever's on screen stays until this answers
  load: async () => {
    try {
      const res = await apiFetch("/api/manga");
      if (!res.ok) throw new Error(res.statusText);
      const { manga } = (await res.json()) as { manga: Manga[] };

      // an answer depends on what they own and where they've read to, so a
      // title edited since it was checked needs checking again
      const { manga: before, releases } = get();
      const stillGood = { ...releases };
      for (const m of manga) {
        const old = before?.find((b) => b.id === m.id);
        if (
          old &&
          (old.volumesOwned !== m.volumesOwned || old.bookmark !== m.bookmark)
        ) {
          delete stillGood[m.id];
        }
      }
      set({ manga, releases: stillGood, loadFailed: false });
    } catch {
      // a failed refresh is only a problem if there's nothing to show
      if (!get().manga) set({ loadFailed: true });
    }
  },

  // one title at a time, since the server has to ask other sites about each one
  // it hasn't seen lately
  checkReleases: async () => {
    if (run) return;
    const controller = new AbortController();
    run = controller;
    while (!controller.signal.aborted) {
      const { manga, releases } = get();
      const next = manga?.find((m) => !(m.id in releases));
      if (!next) break;
      const status = await getReleases(
        next.id,
        AbortSignal.any([
          controller.signal,
          AbortSignal.timeout(RELEASE_CHECK_TIMEOUT_MS),
        ]),
      )
        .then((found) => found.releaseStatus)
        .catch(() => null);
      if (controller.signal.aborted) return;
      set((state) => ({ releases: { ...state.releases, [next.id]: status } }));
    }
    run = null;
  },

  reset: () => {
    run?.abort();
    run = null;
    set({ manga: null, loadFailed: false, releases: {} });
  },
}));
