// The To buy list: volumes a signed-in reader looked up and means to buy.
// The server keeps it and prices it from what's stored (server toBuy/toBuy.ts)
import { apiFetch, getJson } from "./api";
import { orOffline } from "./offline";

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
  // their own note on it, and its place in their own order; null until
  // they've set one (the app's To buy page; the website doesn't set them)
  note?: string | null;
  position?: number | null;
  // the price they asked to be told at, in cents (an alert on their phone
  // when a copy is at or under it); null when none is named
  alertCents?: number | null;
  // the series' volumes it certainly holds; null when that isn't certain (an
  // edition's book whose title doesn't say, a box set). Never a guess
  volumes: number[] | null;
  // an edition's book (Deluxe, VIZBIG), not one volume
  edition: boolean;
  // its series on their shelf, and whether it's all theirs or on order
  shelf: { id: number; name: string; state: "owned" | "ordered" | null } | null;
};

// what "I bought it" or "I ordered it" did (server toBuy.ts Settled)
export type Settled = {
  done: "owned" | "ordered" | null;
  series: string;
  shelf: { id: number; name: string } | null;
  volumes: number[] | null;
  // a light novel's book: the novel is looked up, never the manga
  lightNovel: boolean;
};

// "Add it to your shelf?" (server toBuy.ts addFromToBuy): the series added,
// or the one by that name already there, with the book's volumes when certain
export type AddedFromToBuy = {
  added: boolean;
  id: number;
  name: string;
  done: "owned" | "ordered" | null;
  volumes: number[] | null;
};

export async function addSeriesFromToBuy(
  isbn13: string,
  asked: {
    name: string;
    planned: boolean;
    how: "owned" | "ordered";
    // the other volumes they ticked: theirs already
    owned?: number[];
    // the chapter they've read up to, when reading
    bookmark?: number | null;
  },
) {
  const res = await apiFetch(`/api/to-buy/${isbn13}/add-series`, {
    method: "POST",
    body: asked,
  });
  const data = (await res.json().catch(() => null)) as
    (AddedFromToBuy & { error?: { msg?: string }[] }) | null;
  if (!res.ok || !data)
    throw new Error(
      data?.error?.[0]?.msg ?? orOffline("That didn't save. Try again."),
    );
  return data;
}

// "I bought it" or "I ordered it": off the list, and on the shelf when the
// server's certain which series and volumes
export async function settleToBuy(isbn13: string, how: "owned" | "ordered") {
  const res = await apiFetch(`/api/to-buy/${isbn13}/settle`, {
    method: "POST",
    body: { how },
  });
  if (!res.ok) throw new Error(orOffline("That didn't save. Try again."));
  return (await res.json()) as Settled;
}

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
  throw new Error(
    data?.error?.[0]?.msg ?? orOffline("That didn't save. Try again."),
  );
}
// empties the whole list
export async function clearToBuy() {
  const res = await apiFetch("/api/to-buy", { method: "DELETE" });
  if (!res.ok) throw new Error(orOffline("That didn't save. Try again."));
}
export const addToBuy = (isbn13: string) => change("PUT", isbn13);
export const removeToBuy = (isbn13: string) => change("DELETE", isbn13);

// ---------- the order the list is shown in ----------

// the ways to order the list; the first is the one with no ?sort= in the URL
// their note on one item; empty takes it off
export async function saveToBuyNote(isbn13: string, note: string) {
  const res = await apiFetch(`/api/to-buy/${isbn13}`, {
    method: "PATCH",
    body: { note },
  });
  if (!res.ok) throw new Error("That didn't save. Try again.");
}

// the price they want an alert at, in cents; null takes it off
export async function saveToBuyAlert(
  isbn13: string,
  alertCents: number | null,
) {
  const res = await apiFetch(`/api/to-buy/${isbn13}`, {
    method: "PATCH",
    body: { alertCents },
  });
  if (!res.ok) throw new Error("That didn't save. Try again.");
}

// their own order for the list, first to last
export async function saveToBuyOrder(isbns: string[]) {
  const res = await apiFetch("/api/to-buy/order", {
    method: "PUT",
    body: { isbns },
  });
  if (!res.ok) throw new Error("That didn't save. Try again.");
}

// the list in their own order: the ones they've placed first, as placed,
// then the rest as the server sends them (newest added first)
export function inOwnOrder(items: ToBuyItem[]) {
  return [...items].sort(
    (a, b) =>
      Number(a.position == null) - Number(b.position == null) ||
      (a.position ?? 0) - (b.position ?? 0),
  );
}

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
