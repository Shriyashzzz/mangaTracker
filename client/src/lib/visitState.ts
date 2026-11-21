// What a page was doing, kept for its place in the history: going Back to it
// brings it back as it was left (which block of volumes, a filter on, the
// folds that were open), as an Android app's screens are. A fresh visit, by
// a link or a tap, always starts clean.
//
// Kept in this tab's sessionStorage under the history entry's position and
// the page's path, not React Router's own key, which changes whenever the
// page rewrites its address (?edition=) without leaving it. Only for a
// while: back after more than KEEP_MS away, the page opens fresh, as an app
// left in the background a long time does (the time they left is noted by
// lib/RestoreOnBack.tsx).
import { useState } from "react";
import { useLocation, useNavigationType } from "react-router";

// how long a page's place is kept after they leave it
export const KEEP_MS = 5 * 60 * 1000;

export const historyEntry = () =>
  (window.history.state as { idx?: number } | null)?.idx ?? 0;

export const visitKey = (
  pathname: string,
  name: string,
  entry = historyEntry(),
) => `visit:${entry}:${pathname}:${name}`;

// whether this page's place is still worth putting back: left less than
// KEEP_MS ago (no time noted, as after a reload: yes)
export function stillFresh(pathname: string) {
  const left = readVisit<number>(visitKey(pathname, "leftAt"));
  return left == null || Date.now() - left <= KEEP_MS;
}

export function readVisit<T>(key: string): T | undefined {
  try {
    const kept = sessionStorage.getItem(key);
    return kept == null ? undefined : (JSON.parse(kept) as T);
  } catch {
    return undefined;
  }
}

export function writeVisit(key: string, value: unknown) {
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    // storage off or full: Back just opens the page fresh
  }
}

// useState, remembered for this visit: the value it had when they left
// comes back with Back, a fresh visit starts at `initial`
export function useVisitState<T>(name: string, initial: T) {
  const { pathname } = useLocation();
  const back = useNavigationType() === "POP";
  const [key] = useState(() => visitKey(pathname, name));
  const [value, setValue] = useState<T>(() => {
    const kept = back && stillFresh(pathname) ? readVisit<T>(key) : undefined;
    return kept === undefined ? initial : kept;
  });
  const set = (next: T | ((now: T) => T)) =>
    setValue((now) => {
      const value =
        typeof next === "function" ? (next as (now: T) => T)(now) : next;
      writeVisit(key, value);
      return value;
    });
  return [value, set] as const;
}
