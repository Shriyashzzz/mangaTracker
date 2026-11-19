// Changes made with no connection, kept on this device until they can be
// sent: the volumes ticked on a series' shelf, the chapter or volume read,
// finished or not, To read, the rating and the notes. Everything else
// can't be changed offline (lib/offline.ts).
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
import { CONNECTION_BACK, isNetworkError, isOffline } from "./offline";
import {
  changesNothing,
  combinedChange,
  combinedOwned,
  inOrder,
  sentNote,
  toSend,
  type ChangeKind,
  type ChangeValue,
  type OfflineChange,
} from "./offlineChangeRules";

// the rules themselves, for the pages that show changes
export { withChanges, type OfflineChange } from "./offlineChangeRules";

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
  const had = await changeOf(`${mangaId}:owned`).catch(() => undefined);
  await keep(combinedOwned(had, mangaId, started, ended, Date.now()));
  await recount();
  sendWhenBack();
}

// the chapter, the volume read, finished, To read, the rating or the
// notes, changed from one value to another. Changed back to where it
// started: nothing's left to send
export async function keepChange(
  mangaId: number,
  kind: ChangeKind,
  from: ChangeValue,
  to: ChangeValue,
) {
  const key = `${mangaId}:${kind}`;
  const had = await changeOf(key).catch(() => undefined);
  const change = combinedChange(had, mangaId, kind, from, to, Date.now());
  if (changesNothing(change)) await drop(key).catch(() => undefined);
  else await keep(change);
  await recount();
  sendWhenBack();
}

// Saved now if there's a connection; kept on this device to go when
// there's one again if not. `send` is the ordinary save. Throws when the
// server refuses it (that one isn't kept)
export async function saveOrKeep(
  mangaId: number,
  kind: ChangeKind,
  from: ChangeValue,
  to: ChangeValue,
  send: () => Promise<Response>,
): Promise<"saved" | "kept"> {
  const keepIt = async () => {
    await keepChange(mangaId, kind, from, to);
    return "kept" as const;
  };
  if (isOffline()) return keepIt();
  let res: Response;
  try {
    res = await send();
  } catch (e) {
    if (isNetworkError(e)) return keepIt();
    throw e;
  }
  if (!res.ok) throw new Error(`answered ${res.status}`);
  // saved over one still waiting from offline: that one's out of date now,
  // and sent later it would undo this
  const key = `${mangaId}:${kind}`;
  if (await changeOf(key).catch(() => undefined)) {
    await drop(key).catch(() => undefined);
    await recount();
  }
  return "saved";
}

// what a change kept on this device says
export const KEPT_NOTE = "Kept on this device. It saves when you're back.";

// ---------- showing them ----------

// the changes not sent yet, for drawing a series as it is on this device
export const waitingChanges = allChanges;

// ---------- sending them ----------

// what the app does when they've been sent: the shelf asked for again
export const CHANGES_SENT = "offlinechangessent";

type Answer = { saved: true } | { saved: false; reason: string };

// the most the server takes in one go (server offline/offlineChanges.ts
// MOST_CHANGES): any more go in the next send
export const MOST_PER_SEND = 200;

export async function sendChanges(): Promise<void> {
  if (useOfflineChanges.getState().sending || isOffline()) return;
  const waiting = inOrder(await allChanges());
  if (!waiting.length) return;
  const changes = waiting.slice(0, MOST_PER_SEND);
  let sentAll = false;
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
    sentAll = true;
  } catch {
    // the connection dropped again: they stay, and go next time
  } finally {
    useOfflineChanges.setState({ sending: false });
    await recount();
  }
  // more than one send's worth: the rest go now
  if (sentAll && waiting.length > changes.length) return sendChanges();
}

// as the app starts: anything waiting goes, and goes whenever the signal's
// back. The service worker says when it sent them itself
export function startSendingChanges() {
  window.addEventListener("online", () => void sendChanges());
  window.addEventListener(CONNECTION_BACK, () => void sendChanges());
  navigator.serviceWorker?.addEventListener("message", (e) => {
    if (e.data !== "changes-sent") return;
    void recount();
    window.dispatchEvent(new Event(CHANGES_SENT));
  });
  void recount();
  void sendChanges();
}

// all of them, gone: once they've signed out (after trying to send them)
export async function forgetChanges() {
  await inStore("readwrite", (s) => s.clear()).catch(() => undefined);
  useOfflineChanges.setState({ waiting: 0, note: null });
}

export const clearChangesNote = () =>
  useOfflineChanges.setState({ note: null });
