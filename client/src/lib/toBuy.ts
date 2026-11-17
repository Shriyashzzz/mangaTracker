// The To buy list: volumes a signed-in reader looked up and means to buy.
// The server keeps it and prices it from what's stored (server toBuy/toBuy.ts)
import { apiFetch, getJson } from "./api";

// a price on the list: how much, and where
export type ToBuyPrice = { cents: number; store: string } | null;

export type ToBuyItem = {
  isbn13: string;
  title: string;
  series: string;
  // null for a book that isn't one numbered volume
  volume: number | null;
  // its cover as its price page has it, and its series' cover to stand in
  coverUrl: string | null;
  seriesCoverUrl: string | null;
  new: ToBuyPrice;
  used: ToBuyPrice;
  // its release date while it isn't out yet (a preorder); null once it's out
  outOn: string | null;
  addedAt: string;
};

// each kind added up over the volumes that have a price of that kind
type ToBuySum = { cents: number; volumes: number };
export type ToBuyList = {
  items: ToBuyItem[];
  totals: { volumes: number; new: ToBuySum; used: ToBuySum };
};

export const getToBuy = (signal?: AbortSignal) =>
  getJson<ToBuyList>("/api/to-buy", signal);

// adds or takes off one volume; throws with the server's words when it
// can't (a full list says so)
async function change(method: "PUT" | "DELETE", isbn13: string) {
  const res = await apiFetch(`/api/to-buy/${isbn13}`, { method });
  if (res.ok) return;
  const data = (await res.json().catch(() => null)) as {
    error?: { msg?: string }[];
  } | null;
  throw new Error(data?.error?.[0]?.msg ?? "That didn't save. Try again.");
}
// empties the whole list
export async function clearToBuy() {
  const res = await apiFetch("/api/to-buy", { method: "DELETE" });
  if (!res.ok) throw new Error("That didn't save. Try again.");
}
export const addToBuy = (isbn13: string) => change("PUT", isbn13);
export const removeToBuy = (isbn13: string) => change("DELETE", isbn13);

// ---------- the order the list is shown in ----------

// the ways to order the list; the first is the one with no ?sort= in the URL
export const TO_BUY_SORTS = [
  { value: "added", label: "Newest added" },
  { value: "series", label: "Series, A to Z" },
  { value: "cheapest", label: "Lowest price" },
  { value: "dearest", label: "Highest price" },
] as const;
export type ToBuySort = (typeof TO_BUY_SORTS)[number]["value"];

// the least a volume can be had for now, new or used; null with no price
const lowestCents = (item: ToBuyItem) => {
  const prices = [item.new?.cents, item.used?.cents].filter(
    (cents) => cents !== undefined,
  );
  return prices.length ? Math.min(...prices) : null;
};

const bySeries = (a: ToBuyItem, b: ToBuyItem) =>
  a.series.localeCompare(b.series) ||
  (a.volume ?? Infinity) - (b.volume ?? Infinity) ||
  a.title.localeCompare(b.title);

// by price, one way or the other; a volume with no price always goes last
const byPrice = (direction: 1 | -1) => (a: ToBuyItem, b: ToBuyItem) => {
  const one = lowestCents(a);
  const other = lowestCents(b);
  if (one === null || other === null)
    return Number(one === null) - Number(other === null) || bySeries(a, b);
  return direction * (one - other) || bySeries(a, b);
};

// the list in the order asked for. The server sends it newest added first
export function sortToBuy(items: ToBuyItem[], sort: ToBuySort) {
  if (sort === "added") return items;
  const order =
    sort === "series" ? bySeries : byPrice(sort === "cheapest" ? 1 : -1);
  return [...items].sort(order);
}
