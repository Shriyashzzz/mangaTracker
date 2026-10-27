// Who's signed in, shared by every component (zustand, like where-is-waldo).
// Replaces the old <Outlet context={[isSignedIn, setIsSignedIn]}>.
//
//   isSignedIn  null  = still asking the server (pages show a skeleton,
//                       so they don't flash the guest view)
//               true / false once it has answered
import { create } from "zustand";
import { apiFetch } from "../lib/api";
import { syncPrefs } from "../lib/prefs";

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
      // the account's background and theme follow the user
      if (res.ok) syncPrefs();
    } catch {
      set({ isSignedIn: false });
    }
  },

  signedIn: () => {
    set({ isSignedIn: true });
    syncPrefs();
  },

  logOut: async () => {
    const res = await apiFetch("/api/auth/logout", { method: "POST" });
    if (res.ok) set({ isSignedIn: false });
    return res.ok;
  },
}));
