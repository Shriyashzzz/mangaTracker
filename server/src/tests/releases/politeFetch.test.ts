// Release checks stay under MangaDex's and MangaUpdates' limits, however many
// requests are made at once
import { politeFetch, retryAfterMs } from "../../util/politeFetch.js";

const realFetch = global.fetch;
let sent: { url: string; at: number }[] = [];
let answers: Response[] = [];
beforeEach(() => {
  sent = [];
  answers = [];
  global.fetch = (async (url: string) => {
    sent.push({ url, at: Date.now() });
    return answers.shift() ?? new Response("{}", { status: 200 });
  }) as typeof fetch;
});
afterAll(() => {
  global.fetch = realFetch;
});

const gaps = () => sent.slice(1).map((s, i) => s.at - sent[i]!.at);

test("MangaDex requests made all at once go out spaced, under 4 a second", async () => {
  await Promise.all(
    Array.from({ length: 5 }, (_, i) => politeFetch(`https://api.mangadex.org/manga/${i}`)),
  );
  expect(sent).toHaveLength(5);
  // a few ms either way for timers
  expect(Math.min(...gaps())).toBeGreaterThanOrEqual(290);
  // the first four took at least 0.9s, so never 4 inside one second
  expect(sent[4]!.at - sent[0]!.at).toBeGreaterThanOrEqual(1150);
});

test("MangaUpdates goes one a second, and the two sites don't wait on each other", async () => {
  const start = Date.now();
  await Promise.all([
    politeFetch("https://api.mangaupdates.com/v1/series/search"),
    politeFetch("https://api.mangaupdates.com/v1/series/1"),
    politeFetch("https://api.mangadex.org/manga?title=x"),
  ]);
  const mu = sent.filter((s) => s.url.includes("mangaupdates"));
  const md = sent.find((s) => s.url.includes("mangadex"))!;
  expect(mu[1]!.at - mu[0]!.at).toBeGreaterThanOrEqual(1090);
  // MangaDex's own turn, not behind MangaUpdates' second (its slot may still
  // be booked from the test before)
  expect(md.at - start).toBeLessThan(400);
});

test("other sites aren't held up at all", async () => {
  const start = Date.now();
  await Promise.all([1, 2, 3].map((i) => politeFetch(`https://openlibrary.org/${i}`)));
  expect(Date.now() - start).toBeLessThan(100);
});

test("a slow down waits as long as asked, then tries once more", async () => {
  answers = [
    new Response("", { status: 429, headers: { "Retry-After": "1" } }),
    new Response("{}", { status: 200 }),
  ];
  const res = await politeFetch("https://api.mangaupdates.com/v1/series/9");
  expect(res.status).toBe(200);
  expect(sent).toHaveLength(2);
  expect(sent[1]!.at - sent[0]!.at).toBeGreaterThanOrEqual(1090);
});

test("asked to wait too long: gives up rather than holding the check", async () => {
  answers = [new Response("", { status: 429, headers: { "Retry-After": "120" } })];
  const res = await politeFetch("https://api.mangadex.org/manga/slow");
  expect(res.status).toBe(429);
  expect(sent).toHaveLength(1);
});

test("MangaDex says when to come back as a time, others as seconds", () => {
  const now = 1_800_000_000_000;
  const at = (h: Record<string, string>) => retryAfterMs(new Response("", { headers: h }), now);
  expect(at({ "X-RateLimit-Retry-After": String(now / 1000 + 5) })).toBe(5000);
  expect(at({ "Retry-After": "3" })).toBe(3000);
  expect(at({})).toBeNull();
});

test("a request's time limit starts when it's sent, not while it waits its turn", async () => {
  // three at once: the third waits ~600ms in the queue, longer than its 400ms
  // limit; it still gets its full 400ms once sent
  global.fetch = (async (_url: string, init?: RequestInit) => {
    await new Promise((r) => setTimeout(r, 50));
    if (init?.signal?.aborted) throw new Error("aborted before it was sent");
    return new Response("{}", { status: 200 });
  }) as typeof fetch;
  const all = await Promise.all(
    [1, 2, 3].map((i) => politeFetch(`https://api.mangadex.org/queue/${i}`, { timeoutMs: 400 })),
  );
  expect(all.map((r) => r.status)).toEqual([200, 200, 200]);
});
