// Display preferences: the page background and light/dark. Applied to
// <html data-bg data-theme>, remembered in localStorage, and kept on the
// account when signed in. index.html applies the stored ones before first
// paint so there's no flash.
import { apiFetch } from "./api";
import type { Background, Prefs, Theme } from "./types";

// the page backgrounds, drawn in styles/backdrop.css
export const BACKGROUNDS: { id: Background; label: string }[] = [
  { id: "sfx", label: "Sound effect" },
  { id: "ink", label: "Ink brush" },
  { id: "pages", label: "Stack of pages" },
  { id: "panels", label: "Panels" },
];
export const DEFAULT_BACKGROUND: Background = "sfx";

const isBackground = (value: unknown): value is Background =>
  BACKGROUNDS.some((b) => b.id === value);
const isTheme = (value: unknown): value is Theme =>
  value === "light" || value === "dark";

const writeLocal = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value);
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

// puts preferences on the page and remembers them in this browser
export const applyPrefs = ({ background, theme }: Prefs = {}) => {
  if (isBackground(background)) {
    document.documentElement.dataset.bg = background;
    writeLocal("bg", background);
  }
  if (isTheme(theme)) {
    document.documentElement.dataset.theme = theme;
    writeLocal("theme", theme);
  }
};

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
    applyPrefs(stored);
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
