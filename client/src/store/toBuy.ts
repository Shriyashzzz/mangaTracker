// The signed-in reader's To buy list. Kept here so the header's count, a
// volume page's button and the list's own page always agree.
import { create } from "zustand";
import {
  addToBuy,
  clearToBuy,
  getToBuy,
  removeToBuy,
  type ToBuyList,
} from "../lib/toBuy";

type ToBuyState = {
  // null until it's been asked for
  list: ToBuyList | null;
  loadFailed: boolean;
  load: () => Promise<void>;
  // each saves, then reads the list again: its prices and totals are the
  // server's. Both throw with what went wrong, in words for the page
  add: (isbn13: string) => Promise<void>;
  remove: (isbn13: string) => Promise<void>;
  // every volume off at once
  clear: () => Promise<void>;
  // on signing in or out: it's someone else's list now
  reset: () => void;
};

export const useToBuy = create<ToBuyState>()((set, get) => ({
  list: null,
  loadFailed: false,
  load: async () => {
    try {
      set({ list: await getToBuy(), loadFailed: false });
    } catch {
      set({ loadFailed: true });
    }
  },
  add: async (isbn13) => {
    await addToBuy(isbn13);
    await get().load();
  },
  remove: async (isbn13) => {
    await removeToBuy(isbn13);
    await get().load();
  },
  clear: async () => {
    await clearToBuy();
    await get().load();
  },
  reset: () => set({ list: null, loadFailed: false }),
}));

// asks for the list once, when someone is signed in and it isn't here yet
export const loadToBuyOnce = () => {
  const { list, load } = useToBuy.getState();
  if (!list) void load();
};
