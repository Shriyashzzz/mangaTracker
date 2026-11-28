// The signed-in account's details. Here so the header's picture and the settings
// page always agree.
import { create } from "zustand";
import {
  getAccount,
  linkGoogle,
  saveAccount,
  setFirstPassword,
  setWeeklyEmail,
  type Account,
} from "../lib/account";

type AccountState = {
  account: Account | null;
  loadFailed: boolean;
  load: () => Promise<void>;
  // throws with what was wrong, in words for the page
  save: (patch: Parameters<typeof saveAccount>[0]) => Promise<void>;
  // the weekly email's switch; throws the same way
  weeklyEmail: (on: boolean) => Promise<void>;
  // the weekly email with no address saved yet: saving the first address
  // switches it on and mails the confirm link. Throws the same way
  startWeeklyEmail: (email: string) => Promise<void>;
  // signing in with Google too, and a Google account's first password;
  // both throw the same way
  linkGoogle: (credential: string) => Promise<void>;
  firstPassword: (password: string) => Promise<void>;
  clear: () => void;
};

export const useAccount = create<AccountState>()((set) => ({
  account: null,
  loadFailed: false,
  load: async () => {
    try {
      set({ account: await getAccount(), loadFailed: false });
    } catch {
      set({ loadFailed: true });
    }
  },
  save: async (patch) => {
    set({ account: await saveAccount(patch) });
  },
  weeklyEmail: async (on) => {
    set({ account: await setWeeklyEmail(on) });
  },
  // an account's first address switches the weekly email on and mails its
  // confirm link by itself (server models/userQueries.ts updateAccount), so
  // saving it is the whole of it: a second "on" would mail the link twice
  startWeeklyEmail: async (email) => {
    set({ account: await saveAccount({ recoveryEmail: email }) });
  },
  linkGoogle: async (credential) => {
    set({ account: await linkGoogle(credential) });
  },
  firstPassword: async (password) => {
    set({ account: await setFirstPassword(password) });
  },
  clear: () => set({ account: null, loadFailed: false }),
}));
