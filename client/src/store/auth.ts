// Who's signed in, shared by every component (zustand, like where-is-waldo).
// Replaces the old <Outlet context={[isSignedIn, setIsSignedIn]}>.
//
//   isSignedIn  null  = still asking the server (pages show a skeleton,
//                       so they don't flash the guest view)
//               true / false once it has answered
import { create } from "zustand";
import { forgetKeptShelf } from "../lib/offline";
import { forgetChanges, sendChanges } from "../lib/offlineChanges";
import { apiFetch } from "../lib/api";
import { useShelf } from "./shelf";
import { useToBuy } from "./toBuy";
import { useBookImport } from "./bookImport";
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
    // what another account kept here for offline goes (lib/offline.ts).
    // Changes made offline are sent, not dropped: a session that ran out
    // offline is the same reader signing in again, and the server refuses
    // any change to a series that isn't the signed-in account's
    void forgetKeptShelf();
    void sendChanges();
    useShelf.getState().reset();
    useToBuy.getState().reset();
    // someone else's import, if they shared the browser
    useBookImport.getState().clear();
    set({ isSignedIn: true });
    remember(true);
    syncPrefs();
  },

  logOut: async () => {
    // anything changed offline goes first, while they're still signed in
    await sendChanges();
    const res = await apiFetch("/api/auth/logout", { method: "POST" });
    if (res.ok) {
      void forgetKeptShelf();
      void forgetChanges();
      useShelf.getState().reset();
      useToBuy.getState().reset();
      useBookImport.getState().clear();
      set({ isSignedIn: false });
      remember(false);
    }
    return res.ok;
  },
}));
