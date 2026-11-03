// Going over Open Library's limit can get the whole server blocked
import { jest } from "@jest/globals";

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
  delete process.env.EMAIL_FOR_OPEN_LIB;
});

// a fake Open Library that notes when each request starts and finishes
function fakeOpenLibrary(replyMs = 20) {
  const seen = { maxAtOnce: 0, starts: [] as number[], agents: [] as string[] };
  let atOnce = 0;
  globalThis.fetch = (async (_url: string, init: RequestInit) => {
    atOnce++;
    seen.maxAtOnce = Math.max(seen.maxAtOnce, atOnce);
    seen.starts.push(Date.now());
    seen.agents.push((init.headers as Record<string, string>)["User-Agent"]!);
    await new Promise((r) => setTimeout(r, replyMs));
    atOnce--;
    return new Response(JSON.stringify({ ok: true }));
  }) as typeof fetch;
  return seen;
}

async function load(env: Record<string, string> = {}) {
  jest.resetModules();
  Object.assign(process.env, env);
  return import("../../prices/sources/openLibrary.js");
}

test("with an email: one at a time, under 3 a second, and it's sent", async () => {
  const { openLibraryFetch } = await load({ EMAIL_FOR_OPEN_LIB: "me@example.org" });
  const seen = fakeOpenLibrary();
  const answers = await Promise.all(
    ["a", "b", "c", "d"].map((u) => openLibraryFetch(`https://x.test/${u}`, 1000)),
  );
  expect(seen.maxAtOnce).toBe(1);
  seen.starts.slice(1).forEach((start, i) => {
    expect(start - seen.starts[i]!).toBeGreaterThanOrEqual(340);
  });
  expect(seen.agents[0]).toBe("MangaTracker/1.0 (me@example.org)");
  await expect(answers[0]!.json()).resolves.toEqual({ ok: true });
});

test("without one: slows to under 1 a second and sends no email", async () => {
  const { openLibraryFetch } = await load();
  const seen = fakeOpenLibrary();
  await Promise.all(
    ["a", "b"].map((u) => openLibraryFetch(`https://x.test/${u}`, 1000)),
  );
  expect(seen.starts[1]! - seen.starts[0]!).toBeGreaterThanOrEqual(1040);
  expect(seen.agents[0]).not.toContain("@");
});

test("one failure doesn't stop the requests behind it", async () => {
  const { openLibraryFetch } = await load({ EMAIL_FOR_OPEN_LIB: "me@example.org" });
  const seen = fakeOpenLibrary();
  const works = globalThis.fetch;
  let first = true;
  globalThis.fetch = ((...args: Parameters<typeof fetch>) => {
    if (first) {
      first = false;
      return Promise.reject(new Error("refused"));
    }
    return works(...args);
  }) as typeof fetch;
  const failed = openLibraryFetch("https://x.test/a", 1000);
  const next = openLibraryFetch("https://x.test/b", 1000);
  await expect(failed).rejects.toThrow("refused");
  await expect(next.then((r) => r.ok)).resolves.toBe(true);
  expect(seen.starts).toHaveLength(1);
});

test("the timeout starts at its turn, not while waiting in line", async () => {
  const { openLibraryFetch } = await load({ EMAIL_FOR_OPEN_LIB: "me@example.org" });
  fakeOpenLibrary(150);
  // the second waits about 350ms in line, longer than its own 300ms timeout
  let aborted = false;
  const works = globalThis.fetch;
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    const res = await works(url, init);
    aborted ||= Boolean(init.signal?.aborted);
    return res;
  }) as typeof fetch;
  await Promise.all([
    openLibraryFetch("https://x.test/a", 300),
    openLibraryFetch("https://x.test/b", 300),
  ]);
  expect(aborted).toBe(false);
});
