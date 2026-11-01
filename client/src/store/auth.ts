// Who's signed in, shared by every component (zustand, like where-is-waldo).
// Replaces the old <Outlet context={[isSignedIn, setIsSignedIn]}>.
//
//   isSignedIn  null  = still asking the server (pages show a skeleton,
//                       so they don't flash the guest view)
//               true / false once it has answered
import { create } from "zustand";
import { apiFetch } from "../lib/api";
import { useShelf } from "./shelf";
import { readLocal, syncPrefs, writeLocal } from "../lib/prefs";

// were they signed in last time? Lets the front page wait for the answer rather
// than flash the price search at someone about to go to their shelf. Only a hint:
// the session cookie and /api/auth/me still decide
const SIGNED_IN_KEY = "signedInBefore";
export const probablySignedIn = () => readLocal(SIGNED_IN_KEY) === "yes";
const remember = (signedIn: boolean) =>
  writeLocal(SIGNED_IN_KEY, signedIn ? "yes" : "");

type AuthState = {
  isSignedIn: boolean | null;
  // asks the server once, at start-up
  check: () => Promise<void>;
  // after a successful sign in or sign up
  signedIn: () => void;
  logOut: () => Promise<boolean>;
};

export const useAuth = create<AuthState>()((set) => ({
  isSignedIn: null,

  check: async () => {
    try {
      const res = await apiFetch("/api/auth/me");
      set({ isSignedIn: res.ok });
      remember(res.ok);
      // the account's background and theme follow the user
      if (res.ok) syncPrefs();
    } catch {
      // the server didn't answer, which says nothing about their session
      set({ isSignedIn: false });
    }
  },

  signedIn: () => {
    useShelf.getState().reset();
    set({ isSignedIn: true });
    remember(true);
    syncPrefs();
  },

  logOut: async () => {
    const res = await apiFetch("/api/auth/logout", { method: "POST" });
    if (res.ok) {
      useShelf.getState().reset();
      set({ isSignedIn: false });
      remember(false);
    }
    return res.ok;
  },
}));
