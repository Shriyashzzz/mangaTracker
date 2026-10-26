import { apiFetch } from "./api";

// the page backgrounds, drawn in styles/backdrop.css and keyed on <html data-bg>
export const BACKGROUNDS = [
  { id: "sfx", label: "Sound effect" },
  { id: "ink", label: "Ink brush" },
  { id: "pages", label: "Stack of pages" },
  { id: "panels", label: "Panels" },
];
export const DEFAULT_BACKGROUND = "sfx";

const isBackground = (value) => BACKGROUNDS.some((b) => b.id === value);
const isTheme = (value) => value === "light" || value === "dark";

const writeLocal = (key, value) => {
  try {
    localStorage.setItem(key, value);
  } catch {
    // storage can be blocked (private mode), the choice still holds for this visit
  }
};

export const currentBackground = () => {
  const bg = document.documentElement.dataset.bg;
  return isBackground(bg) ? bg : DEFAULT_BACKGROUND;
};

export const currentTheme = () => {
  const explicit = document.documentElement.dataset.theme;
  if (explicit) return explicit;
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
};

// puts preferences on the page and remembers them in this browser
export const applyPrefs = ({ background, theme } = {}) => {
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
export const savePrefs = (patch, isSignedIn) => {
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
    const stored = await response.json();
    applyPrefs(stored);
    const missing = {};
    if (!stored.background) missing.background = currentBackground();
    if (!stored.theme && document.documentElement.dataset.theme) {
      missing.theme = document.documentElement.dataset.theme;
    }
    if (Object.keys(missing).length) {
      await apiFetch("/api/prefs", { method: "PUT", body: missing });
    }
  } catch {
    // keep the local preferences
  }
};
