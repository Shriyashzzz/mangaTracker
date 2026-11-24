// Blocking another reader (server blocks/blocks.ts): their reviews aren't
// shown to you, and neither of you can open or follow the other's shared
// shelf. They're never told. Unblock from Settings, Account
import { apiFetch, getJson } from "./api";
import { orOffline } from "./offline";

export type BlockedReader = { id: number; name: string; avatar: string | null };

// newest first, and how many in all. `limit`: just the first few (the
// preview in Settings); without it, the whole list (its own page)
export type BlockList = { blocks: BlockedReader[]; total: number };
export const getBlocks = (limit?: number) =>
  getJson<BlockList>(limit ? `/api/blocks?limit=${limit}` : "/api/blocks");

// how many Settings shows before "See all"
export const BLOCKS_SHOWN = 3;
// from this many, the full list gets a search box
export const SEARCH_FROM = 10;

// the full list, narrowed to names with what was typed in them
export const blocksMatching = (blocks: BlockedReader[], typed: string) => {
  const q = typed.trim().toLowerCase();
  return q ? blocks.filter((b) => b.name.toLowerCase().includes(q)) : blocks;
};

// what Unblock asks first, so a mis-tap on a long list undoes nothing
export const unblockAsk = (name: string) =>
  `Unblock ${name}? You'll see their reviews again, and you can open and follow each other's shared shelves.`;

// who to block: a review's writer, or a shared shelf's owner
export type BlockWho = { reviewId: number } | { shareCode: string };

export async function blockReader(who: BlockWho) {
  const res = await apiFetch("/api/blocks", { method: "POST", body: who });
  if (!res.ok) throw new Error(orOffline("That didn't work. Try again."));
}

export async function unblockReader(id: number) {
  const res = await apiFetch(`/api/blocks/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error(orOffline("That didn't work. Try again."));
}

// what the button's confirm says, the same on every page: its question,
// and what a block does
export const BLOCK_TITLE = "Block this reader?";
export const BLOCK_WHAT =
  "You won't see their reviews, and neither of you can open or follow the other's shared shelf. They aren't told. You can unblock them in Settings, Account.";
