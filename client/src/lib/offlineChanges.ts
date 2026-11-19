// Changes made with no connection, kept on this device until they can be
// sent: the volumes ticked on a series' shelf, and the chapter or volume
// read. Everything else can't be changed offline (lib/offline.ts).
//
// Each series keeps one change of each kind, however many taps went into
// it: where it started (the first tap's "before") and where it ended up
// (the last tap's "after"). The server applies only what changed between
// the two, so another device's changes since are never undone
// (server/src/offline/offlineRules.ts).
//
// They're kept in the browser's database (IndexedDB), where the service
// worker can read them too: on Android it sends them in the background
// when the signal comes back (public/sw.js, "send-changes"). Anywhere else
// they're sent when the app is next open with a connection.
import { create } from "zustand";
import { apiFetch } from "./api";
import { isOffline } from "./offline";
import { ownedVolumes } from "./ownedVolumes";
import type { Manga } from "./types";

export type PlaceKind = "bookmark" | "readVolume";
export type OfflineChange = { key: string; mangaId: number; at: number } & (
  | { kind: "owned"; started: number[]; ended: number[] }
  | { kind: PlaceKind; from: number | null; to: number | null }
);

// ---------- the browser's database. Kept in step with public/sw.js ----------
const DB_NAME = "manga-tracker";
const STORE = "changes";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    // a browser with its storage blocked (some private modes): nothing kept
    if (!globalThis.indexedDB) return reject(new Error("no IndexedDB"));
    const asked = indexedDB.open(DB_NAME, 1);
    asked.onupgradeneeded = () =>
      asked.result.createObjectStore(STORE, { keyPath: "key" });
    asked.onsuccess = () => resolve(asked.result);
    asked.onerror = () => reject(asked.error);
  });
}

async function inStore<T>(
  mode: IDBTransactionMode,
  act: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await openDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const asked = act(db.transaction(STORE, mode).objectStore(STORE));
      asked.onsuccess = () => resolve(asked.result);
      asked.onerror = () => reject(asked.error);
    });
  } finally {
    db.close();
  }
}

const allChanges = () =>
  inStore<OfflineChange[]>("readonly", (s) => s.getAll()).catch(() => []);
const changeOf = (key: string) =>
  inStore<OfflineChange | undefined>("readonly", (s) => s.get(key));
const keep = (change: OfflineChange) =>
  inStore("readwrite", (s) => s.put(change));
const drop = (key: string) => inStore("readwrite", (s) => s.delete(key));

// ---------- what the offline bar shows ----------
type ChangesState = {
  // changes waiting to be sent
  waiting: number;
  sending: boolean;
  // how the last send went, in words; null when there's nothing to say
  note: string | null;
};
export const useOfflineChanges = create<ChangesState>()(() => ({
  waiting: 0,
  sending: false,
  note: null,
}));
const recount = async () =>
  useOfflineChanges.setState({ waiting: (await allChanges()).length });

// ---------- keeping a change ----------

// on Android, the service worker sends them when the signal's back
function sendWhenBack() {
  void navigator.serviceWorker?.ready
    .then((worker) =>
      (
        worker as ServiceWorkerRegistration & {
          sync?: { register: (tag: string) => Promise<void> };
        }
      ).sync?.register("send-changes"),
    )
    .catch(() => {});
}

// the volumes ticked on a series' shelf: what they owned before, and now
export async function keepOwnedChange(
  mangaId: number,
  started: number[],
  ended: number[],
) {
  const key = `${mangaId}:owned`;
  const had = await changeOf(key).catch(() => undefined);
  await keep({
    key,
    mangaId,
    kind: "owned",
    started: had?.kind === "owned" ? had.started : started,
    ended,
    at: Date.now(),
  });
  await recount();
  sendWhenBack();
}

// the chapter or volume read, moved from one number to another
export async function keepPlaceChange(
  mangaId: number,
  kind: PlaceKind,
  from: number | null,
  to: number | null,
) {
  const key = `${mangaId}:${kind}`;
  const had = await changeOf(key).catch(() => undefined);
  await keep({
    key,
    mangaId,
    kind,
    from: had && had.kind === kind ? had.from : from,
    to,
    at: Date.now(),
  });
  await recount();
  sendWhenBack();
}

// ---------- showing them ----------

// the changes not sent yet, for drawing a series as it is on this device
export const waitingChanges = allChanges;

// a series with its waiting changes on it
export function withChanges(manga: Manga, changes: OfflineChange[]): Manga {
  let shown = manga;
  for (const change of changes) {
    if (change.mangaId !== manga.id) continue;
    if (change.kind === "owned")
      shown = { ...shown, ...ownedVolumes(null, change.ended) };
    else if (change.kind === "bookmark")
      shown = { ...shown, bookmark: change.to };
    else shown = { ...shown, readVolume: change.to };
  }
  return shown;
}

// ---------- sending them ----------

// what the app does when they've been sent: the shelf asked for again
export const CHANGES_SENT = "offlinechangessent";

type Answer = { saved: true } | { saved: false; reason: string };

// a change as the server takes it: what's kept only on this device left off
const toSend = (change: OfflineChange) =>
  change.kind === "owned"
    ? {
        kind: change.kind,
        mangaId: change.mangaId,
        started: change.started,
        ended: change.ended,
      }
    : {
        kind: change.kind,
        mangaId: change.mangaId,
        from: change.from,
        to: change.to,
      };

export async function sendChanges() {
  if (useOfflineChanges.getState().sending || isOffline()) return;
  const changes = await allChanges();
  if (!changes.length) return;
  useOfflineChanges.setState({ sending: true, note: null });
  try {
    const res = await apiFetch("/api/manga/offline-changes", {
      method: "POST",
      body: { changes: changes.map(toSend) },
    });
    // signed out since (the session ran out): kept for when they sign in
    if (!res.ok) return;
    const { answers } = (await res.json()) as { answers: Answer[] };
    let refused = 0;
    for (const [i, change] of changes.entries()) {
      if (!answers[i]?.saved) refused++;
      // sent, unless it was changed again while this was on its way
      const now = await changeOf(change.key).catch(() => undefined);
      if (now?.at === change.at) await drop(change.key);
    }
    const saved = changes.length - refused;
    useOfflineChanges.setState({ note: sentNote(saved, refused) });
    window.dispatchEvent(new Event(CHANGES_SENT));
  } catch {
    // the connection dropped again: they stay, and go next time
  } finally {
    useOfflineChanges.setState({ sending: false });
    await recount();
  }
}

// "Saved 3 changes made offline." A refused one can never save: its series
// was deleted on another device, or the chapter is past the newest out
function sentNote(saved: number, refused: number) {
  const many = (n: number) => (n === 1 ? "1 change" : `${n} changes`);
  if (!refused) return `Saved ${many(saved)} made offline.`;
  const not = `${many(refused)} made offline couldn't be saved.`;
  return saved ? `Saved ${many(saved)}. ${not}` : not;
}

// as the app starts: anything waiting goes, and goes whenever the signal's
// back. The service worker says when it sent them itself
export function startSendingChanges() {
  window.addEventListener("online", () => void sendChanges());
  navigator.serviceWorker?.addEventListener("message", (e) => {
    if (e.data !== "changes-sent") return;
    void recount();
    window.dispatchEvent(new Event(CHANGES_SENT));
  });
  void recount();
  void sendChanges();
}

// all of them, gone: before someone else signs in on this browser
export async function forgetChanges() {
  await inStore("readwrite", (s) => s.clear()).catch(() => undefined);
  useOfflineChanges.setState({ waiting: 0, note: null });
}

export const clearChangesNote = () =>
  useOfflineChanges.setState({ note: null });
