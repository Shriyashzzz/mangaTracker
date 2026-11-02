// The signed-in account's details. Here so the header's picture and the settings
// page always agree.
import { create } from "zustand";
import { getAccount, saveAccount, type Account } from "../lib/account";

type AccountState = {
  account: Account | null;
  loadFailed: boolean;
  load: () => Promise<void>;
  // throws with what was wrong, in words for the page
  save: (patch: Parameters<typeof saveAccount>[0]) => Promise<void>;
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
  clear: () => set({ account: null, loadFailed: false }),
}));
