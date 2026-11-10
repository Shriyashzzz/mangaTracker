// The New tab's answers, kept in this browser between visits, so a big shelf
// opens on what it found last time instead of checking every series again.
// Each answer is used only while the series is as it was when it was checked
// (its title, what they own, where they've read to); older than STALE_MS it
// still shows, and gets checked again quietly. Cleared on signing in or out
// and by "Check again"
import { isDemo } from "./demo";
import type { ReleaseOutcome } from "./releaseMath";
import type { Manga, ReleaseStatus } from "./types";

const KEY = "releaseAnswers";
// checked again (quietly) after this, as the server's own answers expire
export const STALE_MS = 6 * 60 * 60 * 1000;
// not shown at all after this: a week-old "new" would mislead
const KEEP_MS = 7 * 24 * 60 * 60 * 1000;

type Entry = {
  s: ReleaseStatus | null;
  o: ReleaseOutcome;
  // when it was checked
  at: number;
  // what the series was then
  k: string;
};
type Saved = { v: 1; entries: Record<number, Entry> };

// what the answer depends on: the series, how far they are, and what
// they've hidden (here or on another device)
export const seriesKey = (m: Manga) =>
  JSON.stringify([
    m.name,
    m.volumesOwned,
    m.ownedList ?? null,
    m.bookmark,
    m.lightNovel,
    m.planned ?? null,
    m.seenVolume ?? null,
    m.seenChapter ?? null,
    m.seenJapanVolume ?? null,
    m.hiddenVolumes ?? null,
  ]);

const read = (): Saved | null => {
  if (isDemo()) return null;
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? "null") as Saved;
    return saved?.v === 1 && saved.entries ? saved : null;
  } catch {
    return null;
  }
};

// the answers still good for this shelf, with when each was checked
export function loadAnswers(manga: Manga[], now = Date.now()) {
  const entries = read()?.entries ?? {};
  const releases: Record<number, ReleaseStatus | null> = {};
  const outcomes: Record<number, ReleaseOutcome> = {};
  const checkedAt: Record<number, number> = {};
  for (const m of manga) {
    const e = entries[m.id];
    if (!e || e.k !== seriesKey(m) || now - e.at > KEEP_MS) continue;
    releases[m.id] = e.s;
    outcomes[m.id] = e.o;
    checkedAt[m.id] = e.at;
  }
  return { releases, outcomes, checkedAt };
}

// the shelf's answers as they stand; failed ones aren't worth keeping
export function saveAnswers(
  manga: Manga[],
  releases: Record<number, ReleaseStatus | null>,
  outcomes: Record<number, ReleaseOutcome>,
  checkedAt: Record<number, number>,
) {
  if (isDemo()) return;
  const entries: Record<number, Entry> = {};
  for (const m of manga) {
    const o = outcomes[m.id];
    if (!(m.id in releases) || !o || o === "failed" || !checkedAt[m.id])
      continue;
    entries[m.id] = {
      s: releases[m.id] ?? null,
      o,
      at: checkedAt[m.id]!,
      k: seriesKey(m),
    };
  }
  try {
    localStorage.setItem(KEY, JSON.stringify({ v: 1, entries }));
  } catch {
    // full or blocked: the next visit checks as it always did
  }
}

type Answers = {
  releases: Record<number, ReleaseStatus | null>;
  outcomes: Record<number, ReleaseOutcome>;
  checkedAt: Record<number, number>;
};

// the server's saved answers over what this browser has: each one taken where
// it's newer, or this browser has nothing for that series. fresh: the ones
// young enough not to need checking again
export function mergeSaved(
  state: Answers,
  answers: Record<
    string,
    {
      releaseStatus: ReleaseStatus | null;
      outcome: ReleaseOutcome;
      checkedAt: string;
    }
  >,
  now = Date.now(),
) {
  const releases = { ...state.releases };
  const outcomes = { ...state.outcomes };
  const checkedAt = { ...state.checkedAt };
  const fresh: number[] = [];
  for (const [key, a] of Object.entries(answers)) {
    const id = Number(key);
    const at = Date.parse(a.checkedAt);
    if (!Number.isFinite(at)) continue;
    if (id in releases && (checkedAt[id] ?? 0) >= at) continue;
    releases[id] = a.releaseStatus;
    outcomes[id] = a.outcome;
    checkedAt[id] = at;
    if (now - at <= STALE_MS) fresh.push(id);
  }
  return { state: { releases, outcomes, checkedAt }, fresh };
}

export function clearAnswers() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

// "just now", "25 min ago", "3 h ago", "2 days ago"
export function checkedAgo(at: number, now = Date.now()) {
  const min = Math.max(0, Math.round((now - at) / 60000));
  if (min < 2) return "just now";
  if (min < 60) return `${min} min ago`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  return d === 1 ? "yesterday" : `${d} days ago`;
}
