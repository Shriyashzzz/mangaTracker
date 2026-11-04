// A book import in progress, kept outside the page: matching a big library
// with AniList takes a while (30 lookups a minute when it's busy), so it keeps
// going while they look around the site, and in a hidden tab. Matches are
// remembered, so a reload or a second try carries on where it stopped rather
// than asking AniList again.
import { create } from "zustand";
import { AniListBusy, aniListGapMs, findManga } from "../lib/anilist";
import {
  searchFallbacks,
  toEntry,
  type BookSeries,
  type BookSource,
} from "../lib/imports/bookImport";
import { sendToShelf, type ImportTotals } from "../lib/imports/malImport";
import { useShelf } from "./shelf";

export type Match =
  | {
      // AniList's own id: two rows with the same one are the same series
      anilistId?: number;
      malId: number | null;
      name: string;
      cover: string | null;
    }
  | null
  | "failed";

type BookImportState = {
  source: BookSource | null;
  fileName: string;
  found: BookSeries[] | null;
  matches: Map<string, Match>;
  choices: Map<string, boolean>;
  waitingOnAniList: boolean;
  // how many have gone to the shelf, while adding
  progress: number | null;
  // how many are being added
  adding: number;
  totals: ImportTotals | null;
  failed: string | null;
  finished: boolean;
  // stopped partway through adding: what had gone in by then
  stopped: ImportTotals | null;
  // a new file: anything from the last one is dropped
  load: (source: BookSource, fileName: string, found: BookSeries[]) => void;
  // after a reload: the saved import carries on. On an import page, only that
  // app's import
  resume: (source?: BookSource) => void;
  choose: (key: string, ticked: boolean) => void;
  add: (chosen: BookSeries[]) => Promise<void>;
  // they pressed Stop import: matching ends now, adding after the piece being
  // sent. The import is dropped; matches found stay remembered
  stop: () => void;
  clear: () => void;
};

// ---------- what's remembered between visits ----------

const SAVED_KEY = "bookImport";
// v3: matches carry AniList's id, are picked from five results,
// and a guess only counts when the names line up
const MATCHES_KEY = "bookImportMatches.v3";
const OLD_MATCHES_KEYS = ["bookImportMatches", "bookImportMatches.v2"];
const MATCH_FRESH_MS = 30 * 24 * 60 * 60 * 1000;

type Saved = {
  source: BookSource;
  fileName: string;
  found: BookSeries[];
  choices: [string, boolean][];
};

const read = <T>(key: string): T | null => {
  try {
    return JSON.parse(localStorage.getItem(key) ?? "null") as T | null;
  } catch {
    return null;
  }
};
const write = (key: string, value: unknown) => {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // storage full or blocked: it just won't carry over to the next visit
  }
};

// AniList's answer for a name, as found before
type Remembered = Record<string, { match: Exclude<Match, "failed">; at: number }>;
// a shorter name searched for an exact match is its own answer: "Star Wars"
// exactly isn't AniList's best guess for "Star Wars"
const searchKey = (name: string, lightNovel: boolean, exactOnly = false) =>
  `${lightNovel ? "novel" : "manga"}${exactOnly ? "!" : ""}:${name.toLowerCase()}`;
let remembered: Remembered | null = null;
const rememberedMatches = () => {
  if (!remembered) {
    const now = Date.now();
    remembered = Object.fromEntries(
      Object.entries(read<Remembered>(MATCHES_KEY) ?? {}).filter(
        ([, r]) => now - r.at < MATCH_FRESH_MS,
      ),
    );
  }
  return remembered;
};
const remember = (
  name: string,
  lightNovel: boolean,
  match: Match,
  exactOnly = false,
) => {
  if (match === "failed") return;
  rememberedMatches()[searchKey(name, lightNovel, exactOnly)] = {
    match,
    at: Date.now(),
  };
  write(MATCHES_KEY, remembered);
};

// ---------- waiting, without a hidden tab slowing it down ----------

let worker: Worker | null | undefined;
let nextWait = 0;
const waits = new Map<number, () => void>();
const timerWorker = () => {
  if (worker === undefined) {
    try {
      worker = new Worker(
        new URL("../lib/imports/timer.worker.ts", import.meta.url),
        { type: "module" },
      );
      worker.onmessage = (e: MessageEvent<number>) => {
        waits.get(e.data)?.();
        waits.delete(e.data);
      };
    } catch {
      worker = null;
    }
  }
  return worker;
};
const sleep = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve) => {
    if (signal.aborted) return resolve();
    const id = ++nextWait;
    const done = () => {
      waits.delete(id);
      resolve();
    };
    const w = timerWorker();
    if (w) {
      waits.set(id, done);
      w.postMessage({ id, ms });
    } else setTimeout(done, ms);
    signal.addEventListener("abort", done, { once: true });
  });

// ---------- matching ----------

let lookups: AbortController | null = null;

// AniList unreachable (offline, or blocked) this many series running: the rest
// are marked "couldn't check" straight away rather than each waiting a minute
const UNREACHABLE_AFTER = 3;
const RETRY_AFTER_MS = 60_000;

// one at a time, at AniList's own pace; the list fills in as answers arrive
async function lookUp(list: BookSeries[]) {
  lookups?.abort();
  const controller = new AbortController();
  lookups = controller;
  const { signal } = controller;
  const set = useBookImport.setState;
  const get = useBookImport.getState;
  const found = (key: string, match: Match) =>
    set((s) => ({ matches: new Map(s.matches).set(key, match) }));
  let unreachable = 0;

  // one search, waiting out AniList's "slow down". A request that never gets an
  // answer is waited out once: it's usually the stricter limit, but could be no
  // connection at all
  const search = async (name: string, s: BookSeries, exactOnly: boolean) => {
    for (let attempt = 0; attempt < 3 && !signal.aborted; attempt++) {
      if (unreachable >= UNREACHABLE_AFTER && attempt > 0) break;
      try {
        const answer = await findManga(name, signal, s.lightNovel, exactOnly);
        unreachable = 0;
        return answer;
      } catch (e) {
        if (!(e instanceof AniListBusy)) return "failed" as const;
        if (e.unreachable && attempt > 0) break;
        if (e.unreachable && unreachable >= UNREACHABLE_AFTER) break;
        set({ waitingOnAniList: true });
        await sleep(e.waitSeconds * 1000, signal);
        set({ waitingOnAniList: false });
      }
    }
    unreachable++;
    return "failed" as const;
  };

  // its own names first: the title, then any other name it goes by (a Japanese
  // edition's). Only if AniList knows none of them, shorter forms of the title,
  // and those only count when AniList has something called exactly that, so
  // "Star Wars: Thrawn" can't turn into some Star Wars manga. At most three
  // searches, and none for a name AniList has answered before
  const matchOne = async (s: BookSeries): Promise<Match | undefined> => {
    const own = [...new Set([s.title, ...s.otherNames])];
    const shorter = searchFallbacks(s.title).filter((n) => !own.includes(n));
    let searches = 0;
    let failed = false;
    for (const [names, exactOnly] of [
      [own, false],
      [shorter, true],
    ] as const) {
      // remembered: found before by one of these names
      const known = names
        .map((n) => rememberedMatches()[searchKey(n, s.lightNovel, exactOnly)])
        .find((r) => r && r.match !== null);
      if (known) return known.match;
      for (const name of names) {
        if (searches >= 3) break;
        // answered before: not on AniList by that name
        if (rememberedMatches()[searchKey(name, s.lightNovel, exactOnly)]) continue;
        searches++;
        const answer = await search(name, s, exactOnly);
        if (signal.aborted) return undefined;
        remember(name, s.lightNovel, answer, exactOnly);
        await sleep(aniListGapMs(), signal);
        if (answer === "failed") {
          // couldn't check this one: the next name won't fare better now
          failed = true;
          break;
        }
        if (answer !== null) return answer;
      }
      if (failed) break;
    }
    return failed ? "failed" : null;
  };

  // what they've owned or read first, to-read lists last. One AniList couldn't
  // answer stays "Matching…" until it's had a second go, after a breather, so
  // "all matched" isn't said early
  const order = [...list]
    .sort((a, b) => Number(a.planned) - Number(b.planned))
    .filter((s) => !get().matches.has(s.key));
  const again: BookSeries[] = [];
  for (const s of order) {
    const match = await matchOne(s);
    if (match === undefined || signal.aborted) return;
    if (match === "failed") again.push(s);
    else found(s.key, match);
  }
  if (again.length) {
    unreachable = 0;
    await sleep(RETRY_AFTER_MS, signal);
  }
  for (const s of again) {
    const match = await matchOne(s);
    if (match === undefined || signal.aborted) return;
    found(s.key, match);
  }
  if (lookups === controller) lookups = null;
}

// roughly how long matching the rest takes at AniList's pace right now
export const matchingTimeLeftMs = (remaining: number) =>
  remaining * aniListGapMs();

export function timeLeft(remaining: number) {
  const minutes = Math.round(matchingTimeLeftMs(remaining) / 60_000);
  if (minutes < 1) return "less than a minute left";
  return minutes === 1 ? "about a minute left" : `about ${minutes} minutes left`;
}

// the app of the import saved before a reload, so the import page opens on it
export const savedSource = () => read<Saved>(SAVED_KEY)?.source ?? null;

// ---------- the store ----------

const empty = {
  source: null,
  fileName: "",
  found: null,
  matches: new Map<string, Match>(),
  choices: new Map<string, boolean>(),
  waitingOnAniList: false,
  progress: null,
  adding: 0,
  totals: null,
  failed: null,
  finished: false,
  stopped: null,
};

// Stop import was pressed while adding
let stopAdding = false;

const save = (s: BookImportState) =>
  write(
    SAVED_KEY,
    s.source && s.found
      ? ({
          source: s.source,
          fileName: s.fileName,
          found: s.found,
          choices: [...s.choices],
        } satisfies Saved)
      : null,
  );

export const useBookImport = create<BookImportState>()((set, get) => ({
  ...empty,

  load: (source, fileName, found) => {
    lookups?.abort();
    set({ ...empty, source, fileName, found });
    save(get());
    void lookUp(found);
  },

  resume: (source) => {
    const s = get();
    // already going, or one from another app's page
    if (s.found) {
      if ((!source || s.source === source) && !lookups && !s.finished)
        void lookUp(s.found);
      return;
    }
    const saved = read<Saved>(SAVED_KEY);
    if (!saved?.found?.length || (source && saved.source !== source)) return;
    set({
      ...empty,
      source: saved.source,
      fileName: saved.fileName,
      found: saved.found,
      choices: new Map(saved.choices),
    });
    void lookUp(saved.found);
  },

  choose: (key, ticked) => {
    set((s) => ({ choices: new Map(s.choices).set(key, ticked) }));
    save(get());
  },

  add: async (chosen) => {
    // what's ticked now is what goes: matching stops, so the count can't grow
    // mid-add (it picks up again if adding fails)
    lookups?.abort();
    lookups = null;
    set({ failed: null, progress: 0, adding: chosen.length, stopped: null });
    stopAdding = false;
    const { matches } = get();
    try {
      const done = await sendToShelf(
        chosen.map((s) => {
          const match = matches.get(s.key);
          return toEntry(s, match && match !== "failed" ? match : undefined);
        }),
        (sent, soFar) => set({ progress: sent, totals: soFar }),
        () => stopAdding,
      );
      if (stopAdding) {
        stopAdding = false;
        write(SAVED_KEY, null);
        set({ ...empty, source: get().source, stopped: done });
        return;
      }
      set({ totals: done, finished: true });
      // done with: nothing to pick up next visit
      write(SAVED_KEY, null);
    } catch (e) {
      const { totals, message } = e as { totals?: ImportTotals; message?: string };
      set({
        ...(totals ? { totals } : {}),
        failed: message || "Import failed",
      });
      const { found } = get();
      if (found) void lookUp(found);
    } finally {
      set({ progress: null });
      void useShelf.getState().load();
    }
  },

  stop: () => {
    lookups?.abort();
    lookups = null;
    if (get().progress !== null) {
      stopAdding = true;
      return;
    }
    write(SAVED_KEY, null);
    set({ ...empty });
  },

  // signed out, or a fresh start: nothing of theirs is left behind
  clear: () => {
    lookups?.abort();
    lookups = null;
    remembered = null;
    write(SAVED_KEY, null);
    write(MATCHES_KEY, null);
    OLD_MATCHES_KEYS.forEach((k) => write(k, null));
    set({ ...empty });
  },
}));
