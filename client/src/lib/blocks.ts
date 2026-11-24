// Blocking another reader (server blocks/blocks.ts): their reviews aren't
// shown to you, and neither of you can open or follow the other's shared
// shelf. They're never told. Unblock from Settings, Account
import { apiFetch, getJson } from "./api";
import { orOffline } from "./offline";

export type BlockedReader = { id: number; name: string; avatar: string | null };

export const getBlocks = () =>
  getJson<{ blocks: BlockedReader[] }>("/api/blocks").then((r) => r.blocks);

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
