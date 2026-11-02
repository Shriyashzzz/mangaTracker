// Every request to Open Library goes through here, one at a time. It allows 1 a
// second, or 3 a second from an app that gives its name and a contact email, and
// going over can get the whole server blocked for a while.
// https://openlibrary.org/developers/api
import config from "../config/config.js";

const contact = config.EMAIL_FOR_OPEN_LIB;
const HEADERS = {
  "User-Agent": `MangaTracker/1.0 (${contact ?? "+https://mangatracker.xyz"})`,
};

// from the start of one request to the start of the next, a little over the limit
const GAP_MS = contact ? 350 : 1050;
// a request still in line after this long has nobody waiting on it; better to
// fail, and be asked for again, than to add to the backlog
const MAX_WAIT_MS = 30_000;

let line: Promise<unknown> = Promise.resolve();
let lastStart = 0;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function send(url: string | URL, timeoutMs: number, queuedAt: number) {
  if (Date.now() - queuedAt > MAX_WAIT_MS) {
    throw new Error("Open Library requests are backed up");
  }
  const wait = lastStart + GAP_MS - Date.now();
  if (wait > 0) await sleep(wait);
  lastStart = Date.now();
  const res = await fetch(url, {
    headers: HEADERS,
    signal: AbortSignal.timeout(timeoutMs),
  });
  // read here, so the next request waits until this one has really finished
  return new Response(await res.arrayBuffer(), {
    status: res.status,
    headers: res.headers,
  });
}

export function openLibraryFetch(url: string | URL, timeoutMs: number) {
  const queuedAt = Date.now();
  const turn = line.then(() => send(url, timeoutMs, queuedAt));
  line = turn.catch(() => {});
  return turn;
}
