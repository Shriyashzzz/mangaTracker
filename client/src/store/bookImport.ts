// A book import in progress, kept outside the page: matching a big library
// with AniList takes a while (30 lookups a minute when it's busy), so it keeps
// going while they look around the site, and in a hidden tab. Matches are
// remembered, so a reload or a second try carries on where it stopped rather
// than asking AniList again.
import { create } from "zustand";
import {
  AniListBusy,
  aniListGapMs,
  findManga,
  isNamedFor,
  plain,
  seriesNames,
} from "../lib/anilist";
import {
  groupBooks,
  mergeBooks,
  searchPlan,
  withEdits,
  editOf,
  toEntry,
  type EditOf,
  type Book,
  type BookSeries,
  type BookSource,
  type FileKind,
} from "../lib/imports/bookImport";
import { sendToShelf, type ImportTotals } from "../lib/imports/malImport";
import {
  askShared,
  tellShared,
  type SharedSearch,
} from "../lib/imports/sharedMatches";
import { useShelf } from "./shelf";

export type Match =
  | {
      // AniList's own id: two rows with the same one are the same series
      anilistId?: number;
      malId: number | null;
      name: string;
      cover: string | null;
      // how its name fits the search (lib/anilist.ts matchFrom). Missing on
      // matches from before it was kept, and on shared ones, which are exact
      fit?: "exact" | "parent" | "longer";
      // every name the series goes by (missing on shared matches)
      names?: string[];
      // the series is the book's title cut short, by a shorter search or by
      // matchFrom: the book could be a spin-off AniList doesn't have
      // (withoutSpinOffs in lib/imports/bookImport)
      shorter?: true;
    }
  | null
  | "failed";

// what they changed on a series with Edit, before adding (withEdits in
// lib/imports/bookImport). Kept in their browser only, never told to the
// shared matches
export type Edit = EditOf<Exclude<Match, "failed">>;

type BookImportState = {
  source: BookSource | null;
  // every file in this import, in the order they came in
  fileNames: string[];
  // which app's files they are: one kind per import
  kind: FileKind | null;
  // every book from every file, a book in two files once (mergeBooks)
  books: Book[];
  found: BookSeries[] | null;
  matches: Map<string, Match>;
  choices: Map<string, boolean>;
  edits: Map<string, Edit>;
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
  // new files: anything from the last import is dropped
  load: (source: BookSource, kind: FileKind, files: ImportFile[]) => void;
  // more files of the same app, while it's matching: they join this import,
  // and what's matched so far stays matched
  addFiles: (files: ImportFile[]) => void;
  // after a reload: the saved import carries on. On an import page, only that
  // app's import
  resume: (source?: BookSource) => void;
  choose: (key: string, ticked: boolean) => void;
  // Select all / Clear all: these series, all at once
  chooseAll: (keys: string[], ticked: boolean) => void;
  // Edit's Save: their series and volume count for this one. Choosing a
  // series ticks it, choosing none unticks it
  // on every series in the row (a row can be two spellings AniList says are
  // one), so none of them comes back with the import's match
  edit: (keys: string[], edit: Edit) => void;
  // back to what the import found, tick included
  unedit: (keys: string[]) => void;
  add: (chosen: BookSeries[]) => Promise<void>;
  // they pressed Stop import: matching ends now, adding after the piece being
  // sent. The import is dropped; matches found stay remembered
  stop: () => void;
  clear: () => void;
};

// working right now: matching with AniList or adding to the shelf. Waiting
// for them to review the matches isn't: nothing is running then
export const bookImportBusy = (s: {
  source: BookSource | null;
  found: BookSeries[] | null;
  matches: Map<string, Match>;
  progress: number | null;
  finished: boolean;
}) =>
  Boolean(
    s.source &&
    s.found &&
    !s.finished &&
    (s.progress !== null || s.found.some((f) => !s.matches.has(f.key))),
  );

// ---------- what's remembered between visits ----------

const SAVED_KEY = "bookImport";
// v3: matches carry AniList's id, are picked from five results,
// and a guess only counts when the names line up
// v4: what the shared matches said before only exact names were shared
// (server/src/util/shelf/sharedMatches.ts) isn't trusted
const MATCHES_KEY = "bookImportMatches.v4";
const OLD_MATCHES_KEYS = [
  "bookImportMatches",
  "bookImportMatches.v2",
  "bookImportMatches.v3",
];
const MATCH_FRESH_MS = 30 * 24 * 60 * 60 * 1000;

export type ImportFile = { name: string; books: Book[] };

type Saved = {
  source: BookSource;
  fileNames: string[];
  kind: FileKind | null;
  books: Book[];
  found: BookSeries[];
  choices: [string, boolean][];
  // missing on imports saved before Edit
  edits?: [string, Edit][];
  // saved before an import could take more files
  fileName?: string;
};

const read = <T>(key: string): T | null => {
  try {
    return JSON.parse(localStorage.getItem(key) ?? "null") as T | null;
  } catch {
    return null;
  }
};
// false if it couldn't be kept (storage full or blocked)
const write = (key: string, value: unknown) => {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    // it just won't carry over to the next visit
    return false;
  }
};

// AniList's answer for a name, as found before
type Remembered = Record<
  string,
  { match: Exclude<Match, "failed">; at: number }
>;
// a shorter name searched for an exact match is its own answer: "Star Wars"
// exactly isn't AniList's best guess for "Star Wars"
const searchKey = (name: string, lightNovel: boolean, exactOnly = false) =>
  `${lightNovel ? "novel" : "manga"}${exactOnly ? "!" : ""}:${name.toLowerCase()}`;
let remembered: Remembered | null = null;
// what v3 remembered that holds up now: an answer called exactly what was
// searched. A guess, or one the shared matches gave before only exact names
// were shared, is asked again
const carriedOver = (): Remembered => {
  const old = read<Remembered>("bookImportMatches.v3") ?? {};
  return Object.fromEntries(
    Object.entries(old).filter(([key, r]) => {
      const searched = key.slice(key.indexOf(":") + 1);
      return r.match && plain(r.match.name) === plain(searched);
    }),
  );
};

const rememberedMatches = () => {
  if (!remembered) {
    const saved = read<Remembered>(MATCHES_KEY) ?? carriedOver();
    // nothing from older versions is kept around
    OLD_MATCHES_KEYS.forEach((k) => write(k, null));
    const now = Date.now();
    remembered = Object.fromEntries(
      Object.entries(saved).filter(([, r]) => now - r.at < MATCH_FRESH_MS),
    );
    write(MATCHES_KEY, remembered);
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

// the names matching would search for a series, as it would search them
const searchesFor = (s: BookSeries): SharedSearch[] =>
  searchPlan(s).map((q) => ({ ...q, lightNovel: s.lightNovel }));

// what everyone's imports already know about these series, remembered as if
// found here, so matching skips AniList for them
async function fillFromShared(list: BookSeries[], signal: AbortSignal) {
  const searches = list
    .flatMap(searchesFor)
    .filter(
      (q) => !rememberedMatches()[searchKey(q.name, q.lightNovel, q.exactOnly)],
    );
  if (!searches.length) return;
  const answers = await askShared(searches, signal).catch(() => []);
  const at = Date.now();
  let learnt = 0;
  answers.forEach((match, i) => {
    const q = searches[i]!;
    if (!match) return;
    rememberedMatches()[searchKey(q.name, q.lightNovel, q.exactOnly)] = {
      match,
      at,
    };
    learnt++;
  });
  if (learnt) write(MATCHES_KEY, remembered);
}

// would matching find this series without asking AniList? Read as matchOne
// reads: name by name, a remembered match, or a "not by that name" to go past
const isKnown = (s: BookSeries) => {
  for (const q of searchesFor(s)) {
    const r = rememberedMatches()[searchKey(q.name, q.lightNovel, q.exactOnly)];
    if (r?.match) return true;
    if (!r) return false;
  }
  return false;
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
// matches told to the server in batches of this many, and when matching ends
const TELL_EVERY = 25;

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
  // matches AniList gave this import, told to the server for everyone's next one
  const toTell: (SharedSearch & { anilistId: number })[] = [];
  const tell = () => tellShared(toTell.splice(0));

  // one search, waiting out AniList's "slow down". A request that never gets an
  // answer is waited out once: it's usually the stricter limit, but could be no
  // connection at all
  const search = async (name: string, s: BookSeries, exactOnly: boolean) => {
    for (let attempt = 0; attempt < 3 && !signal.aborted; attempt++) {
      if (unreachable >= UNREACHABLE_AFTER && attempt > 0) break;
      try {
        const answer = await findManga(
          name,
          signal,
          s.lightNovel,
          exactOnly,
          (ms) => sleep(ms, signal),
        );
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

  // in searchPlan's order (lib/imports/bookImport): its own names, then
  // shorter forms. At most three searches, and none for a name AniList has
  // answered before.
  // In that order, remembered or not: a match remembered (or known from other
  // imports) for a later name only counts once the names before it are known
  // not to be on AniList. "Battle Angel Alita - Last Order", also called
  // "Battle Angel Alita" in the file, is Last Order, not the series before it
  const matchOne = async (s: BookSeries): Promise<Match | undefined> => {
    // found by cutting the title short: a spin-off of that series, unless the
    // whole title is just the series' name said another way (isNamedFor). A
    // match without its names (a shared one) has them looked up and kept
    const marked = async (
      match: Match,
      cut: true | undefined,
      key: string,
    ): Promise<Match> => {
      if (!match || match === "failed" || !(cut || match.fit === "parent"))
        return match;
      let names = match.names;
      for (
        let attempt = 0;
        !names && match.anilistId && attempt < 3;
        attempt++
      ) {
        try {
          names = (await seriesNames(match.anilistId, signal)) ?? undefined;
          await sleep(aniListGapMs(), signal);
          break;
        } catch (e) {
          // AniList's "slow down": waited out as it asks, then once more
          if (!(e instanceof AniListBusy) || signal.aborted) break;
          await sleep(e.waitSeconds * 1000, signal);
        }
      }
      if (names && !match.names) {
        // kept, so the next visit doesn't ask again
        const known = rememberedMatches()[key];
        if (known?.match) {
          rememberedMatches()[key] = {
            ...known,
            match: { ...known.match, names },
          };
          write(MATCHES_KEY, remembered);
        }
      }
      const ownName = [s.title, ...s.otherNames].some((t) =>
        isNamedFor(t, names ?? []),
      );
      return ownName ? { ...match, names } : { ...match, names, shorter: true };
    };
    let searches = 0;
    let failed = false;
    for (const { name, exactOnly, cut } of searchPlan(s)) {
      const key = searchKey(name, s.lightNovel, exactOnly);
      const known = rememberedMatches()[key];
      if (known?.match) return await marked(known.match, cut, key);
      // answered before: not on AniList by that name
      if (known) continue;
      // out of searches: only what's remembered for the rest
      if (searches >= 3) continue;
      searches++;
      const answer = await search(name, s, exactOnly);
      if (signal.aborted) return undefined;
      remember(name, s.lightNovel, answer, exactOnly);
      // only an exact name is shared: the server turns guesses away
      // (server/src/util/shelf/sharedMatches.ts fits)
      if (
        answer &&
        answer !== "failed" &&
        answer.anilistId &&
        answer.fit === "exact"
      ) {
        toTell.push({
          name,
          lightNovel: s.lightNovel,
          exactOnly,
          anilistId: answer.anilistId,
        });
        if (toTell.length >= TELL_EVERY) tell();
      }
      await sleep(aniListGapMs(), signal);
      if (answer === "failed") {
        // couldn't check this one: the next name won't fare better now
        failed = true;
        break;
      }
      if (answer !== null) return await marked(answer, cut, key);
    }
    return failed ? "failed" : null;
  };

  // what they've owned or read first, to-read lists last. One AniList couldn't
  // answer stays "Matching…" until it's had a second go, after a breather, so
  // "all matched" isn't said early
  const order = [...list]
    .sort((a, b) => Number(a.planned) - Number(b.planned))
    .filter((s) => !get().matches.has(s.key));
  try {
    // known from other people's imports: no AniList wait for those
    await fillFromShared(order, signal);
    if (signal.aborted) return;
    // the ones it already knows first, so they're all matched at once and the
    // time left is only what AniList still has to answer
    const known = order.filter(isKnown);
    const again: BookSeries[] = [];
    for (const s of [...known, ...order.filter((s) => !known.includes(s))]) {
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
  } finally {
    // stopped or done: what it found still helps the next import
    tell();
  }
}

// roughly how long matching the rest takes at AniList's pace right now
export const matchingTimeLeftMs = (remaining: number) =>
  remaining * aniListGapMs();

export function timeLeft(remaining: number) {
  const minutes = Math.round(matchingTimeLeftMs(remaining) / 60_000);
  if (minutes < 1) return "less than a minute left";
  return minutes === 1
    ? "about a minute left"
    : `about ${minutes} minutes left`;
}

// the app of the import saved before a reload, so the import page opens on it
export const savedSource = () => read<Saved>(SAVED_KEY)?.source ?? null;

// ---------- the store ----------

const empty = {
  source: null,
  fileNames: [] as string[],
  kind: null,
  books: [] as Book[],
  found: null,
  matches: new Map<string, Match>(),
  choices: new Map<string, boolean>(),
  edits: new Map<string, Edit>(),
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

// every file's books too, so a reload can still take more files. A big
// library can be too much for the browser to keep (about 5MB): then without
// them, so a reload still has the import, just not room for more files
const save = (s: BookImportState) => {
  if (!s.source || !s.found) return write(SAVED_KEY, null);
  const saved: Saved = {
    source: s.source,
    fileNames: s.fileNames,
    kind: s.kind,
    books: s.books,
    found: s.found,
    choices: [...s.choices],
    edits: [...s.edits],
  };
  if (!write(SAVED_KEY, saved)) write(SAVED_KEY, { ...saved, books: [] });
};

export const useBookImport = create<BookImportState>()((set, get) => ({
  ...empty,

  load: (source, kind, files) => {
    lookups?.abort();
    const books = files.reduce<Book[]>(
      (all, f) => mergeBooks(all, f.books),
      [],
    );
    const found = groupBooks(books);
    set({
      ...empty,
      source,
      kind,
      fileNames: files.map((f) => f.name),
      books,
      found,
    });
    save(get());
    void lookUp(found);
  },

  addFiles: (files) => {
    const s = get();
    // only into one that's still matching or being looked over
    if (!s.found || !s.books.length || s.progress !== null || s.finished)
      return;
    const books = files.reduce((all, f) => mergeBooks(all, f.books), s.books);
    const found = groupBooks(books);
    set({
      fileNames: [...s.fileNames, ...files.map((f) => f.name)],
      books,
      found,
    });
    save(get());
    // matching starts over on the new list; anything answered is remembered,
    // so only the new series wait for AniList
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
      fileNames: saved.fileNames ?? (saved.fileName ? [saved.fileName] : []),
      kind: saved.kind ?? null,
      books: saved.books ?? [],
      found: saved.found,
      choices: new Map(saved.choices),
      edits: new Map(saved.edits ?? []),
    });
    void lookUp(saved.found);
  },

  choose: (key, ticked) => {
    set((s) => ({ choices: new Map(s.choices).set(key, ticked) }));
    save(get());
  },

  chooseAll: (keys, ticked) => {
    set((s) => {
      const choices = new Map(s.choices);
      for (const key of keys) choices.set(key, ticked);
      return { choices };
    });
    save(get());
  },

  edit: (keys, edit) => {
    set((s) => {
      const edits = new Map(s.edits);
      const choices = new Map(s.choices);
      for (const key of keys) {
        edits.set(key, { ...s.edits.get(key), ...edit });
        if (edit.match !== undefined) choices.set(key, edit.match !== null);
      }
      return { edits, choices };
    });
    save(get());
  },

  unedit: (keys) => {
    set((s) => {
      const edits = new Map(s.edits);
      const choices = new Map(s.choices);
      for (const key of keys) {
        edits.delete(key);
        choices.delete(key);
      }
      return { edits, choices };
    });
    save(get());
  },

  add: async (chosen) => {
    // what's ticked now is what goes: matching stops, so the count can't grow
    // mid-add (it picks up again if adding fails)
    lookups?.abort();
    lookups = null;
    set({ failed: null, progress: 0, adding: chosen.length, stopped: null });
    stopAdding = false;
    const { found, matches: all, edits } = get();
    // as the list shows them: a spin-off AniList doesn't have goes in by
    // its own name, not as the series, and their edits win
    const matches = found ? withEdits(found, all, edits) : all;
    try {
      const done = await sendToShelf(
        chosen.map((s) => {
          const match = matches.get(s.key);
          const chose = editOf(s, edits)?.match;
          // a series they chose goes in by its AniList name, not the file's
          if (chose) return toEntry({ ...s, title: chose.name }, chose);
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
      const { totals, message } = e as {
        totals?: ImportTotals;
        message?: string;
      };
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
