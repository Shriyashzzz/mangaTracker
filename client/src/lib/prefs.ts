// Display preferences: the page background and light/dark. Applied to
// <html data-bg data-theme>, remembered in localStorage, and kept on the
// account when signed in. index.html applies the stored ones before first
// paint so there's no flash.
import { isDemo } from "./demo";
import { useSyncExternalStore } from "react";
import { readTrackBy } from "./reading";
import { apiFetch } from "./api";
import { hasBottomBar } from "./bottomBar";
import type { Background, Prefs, Theme } from "./types";

// the page backgrounds, drawn in styles/backdrop.css
export const BACKGROUNDS: { id: Background; label: string }[] = [
  { id: "sfx", label: "Sound effect" },
  { id: "ink", label: "Ink brush" },
  { id: "pages", label: "Stack of pages" },
  { id: "panels", label: "Panels" },
];
const DEFAULT_BACKGROUND: Background = "sfx";

const isBackground = (value: unknown): value is Background =>
  BACKGROUNDS.some((b) => b.id === value);
const isTheme = (value: unknown): value is Theme =>
  value === "light" || value === "dark";

// the tour's choices stay in its own browser tab: they go when it does, and nothing
// real has to be put back. It starts from whatever this browser already has
const tourKey = (key: string) => `demoLocal:${key}`;

export const readLocal = (key: string) => {
  try {
    if (isDemo()) {
      const chosen = sessionStorage.getItem(tourKey(key));
      if (chosen !== null) return chosen;
    }
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};

export const writeLocal = (key: string, value: string) => {
  try {
    if (isDemo()) sessionStorage.setItem(tourKey(key), value);
    else localStorage.setItem(key, value);
  } catch {
    // storage can be blocked (private mode), the choice still holds for this visit
  }
};

export const currentBackground = (): Background => {
  const bg = document.documentElement.dataset.bg;
  return isBackground(bg) ? bg : DEFAULT_BACKGROUND;
};

export const currentTheme = (): Theme => {
  const explicit = document.documentElement.dataset.theme;
  if (isTheme(explicit)) return explicit;
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
};

const checksListeners = new Set<() => void>();
const countryListeners = new Set<() => void>();
const trackListeners = new Set<() => void>();

// puts preferences on the page and remembers them in this browser
const applyPrefs = ({
  background,
  theme,
  hideEbooks,
  shelfTab,
  shelfSort,
  shelfView,
  releaseChecks,
  country,
  trackBy,
}: Prefs = {}) => {
  if (trackBy && trackBy !== readLocal("trackBy")) {
    writeLocal("trackBy", trackBy);
    trackListeners.forEach((listener) => listener());
  }
  if (isBackground(background)) {
    document.documentElement.dataset.bg = background;
    writeLocal("bg", background);
  }
  if (isTheme(theme)) {
    document.documentElement.dataset.theme = theme;
    writeLocal("theme", theme);
  }
  if (theme === "system") {
    delete document.documentElement.dataset.theme;
    try {
      if (isDemo()) sessionStorage.setItem(tourKey("theme"), "");
      else localStorage.removeItem("theme");
    } catch {
      /* ignore */
    }
  }
  if (hideEbooks) writeLocal("hideEbooks", hideEbooks);
  if (shelfTab) writeLocal("shelfTab", shelfTab);
  if (shelfSort !== undefined) writeLocal("shelfSort", shelfSort);
  if (shelfView) writeLocal("shelfView", shelfView);
  if (country && country !== readLocal("country")) {
    writeLocal("country", country);
    countryListeners.forEach((listener) => listener());
  }
  if (releaseChecks && releaseChecks !== readLocal("releaseChecks")) {
    writeLocal("releaseChecks", releaseChecks);
    checksListeners.forEach((listener) => listener());
  }
};

// whether to look up new volumes and chapters; on unless they've said otherwise
// the shelf's layout: what they chose, or else compact rows on phones (more
// of a big shelf on a small screen) and covers everywhere else
export const shelfViewNow = (): "rows" | "covers" => {
  const chosen = readLocal("shelfView");
  if (chosen === "rows" || chosen === "covers") return chosen;
  return hasBottomBar() ? "rows" : "covers";
};

export const releaseChecksOn = () => readLocal("releaseChecks") !== "off";

// for components: the account's choice can arrive after the page has drawn, or
// be changed in settings, and whatever depends on it should follow straight away
export const useReleaseChecksOn = () =>
  useSyncExternalStore((listener) => {
    checksListeners.add(listener);
    return () => checksListeners.delete(listener);
  }, releaseChecksOn);

// where they shop: US unless they've picked Canada. Every page showing prices
// follows it as it changes, from the menu, settings or a price page
const currentCountry = (): "us" | "ca" =>
  readLocal("country") === "ca" ? "ca" : "us";
export const useCountry = () =>
  useSyncExternalStore((listener) => {
    countryListeners.add(listener);
    return () => countryListeners.delete(listener);
  }, currentCountry);

// how they keep their place: each series its own way unless they've chosen
// one way for all. Every page showing a place follows a change at once
export const trackByNow = () => readTrackBy(readLocal("trackBy"));
export const useTrackBy = () =>
  useSyncExternalStore((listener) => {
    trackListeners.add(listener);
    return () => trackListeners.delete(listener);
  }, trackByNow);

// applies a change right away, and keeps it on the account when signed in
export const savePrefs = (patch: Prefs, isSignedIn: boolean | null) => {
  applyPrefs(patch);
  if (isSignedIn) {
    apiFetch("/api/prefs", { method: "PUT", body: patch }).catch(() => {
      // offline or server down: it's still saved in this browser
    });
  }
};

// on sign in, the account's preferences win; anything the account hasn't
// stored yet is filled in from this browser
export const syncPrefs = async () => {
  try {
    const response = await apiFetch("/api/prefs");
    if (!response.ok) return;
    const stored = (await response.json()) as Prefs;
    // never chosen means on (release checks) or shown (box sets), whatever
    // someone else chose in this browser
    applyPrefs({
      releaseChecks: "on",
      trackBy: "series",
      ...stored,
    });
    const missing: Prefs = {};
    if (!stored.background) missing.background = currentBackground();
    const theme = document.documentElement.dataset.theme;
    if (!stored.theme && isTheme(theme)) missing.theme = theme;
    if (Object.keys(missing).length) {
      await apiFetch("/api/prefs", { method: "PUT", body: missing });
    }
  } catch {
    // keep the local preferences
  }
};
