// The sites release news comes from have rate limits, and they count every
// request this server makes, for everyone at once: MangaDex allows 5 a second
// from one address, and MangaUpdates asks to be gentle. Each one's requests
// go out one after another with a gap between, so however many shelves are
// being checked, the site stays under their limits. A "slow down" (429) still
// gets one more try, after waiting as long as they ask.
const GAP_MS: Record<string, number> = {
  // under 4 a second
  "api.mangadex.org": 300,
  "api.mangaupdates.com": 1100,
};
// asked to wait longer than this: give up on it, the check tries again later
const MAX_RETRY_WAIT_MS = 30_000;

// when each site's next request may go
const nextSlot = new Map<string, number>();

const sleep = (ms: number) => new Promise((done) => setTimeout(done, ms));

// this request's turn: the next free slot, and the one after it is booked
async function turn(host: string) {
  const gap = GAP_MS[host];
  if (!gap) return;
  const now = Date.now();
  const at = Math.max(now, nextSlot.get(host) ?? 0);
  nextSlot.set(host, at + gap);
  if (at > now) await sleep(at - now);
}

// MangaDex says when, as a time; others say how long, in seconds
export function retryAfterMs(res: Response, now = Date.now()): number | null {
  const at = Number(res.headers.get("X-RateLimit-Retry-After"));
  if (at > 0) return Math.max(0, at * 1000 - now);
  const seconds = Number(res.headers.get("Retry-After"));
  return seconds > 0 ? seconds * 1000 : null;
}

export async function politeFetch(url: string, init?: RequestInit) {
  const host = new URL(url).host;
  await turn(host);
  const res = await fetch(url, init);
  if (res.status !== 429) return res;
  const wait = retryAfterMs(res) ?? 1000;
  if (wait > MAX_RETRY_WAIT_MS || init?.signal?.aborted) return res;
  await sleep(wait);
  await turn(host);
  return fetch(url, init);
}
