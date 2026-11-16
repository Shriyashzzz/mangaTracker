// AniList's allowance, shared (prices/sources/anilist.ts): the background
// jobs take at most their share a minute, so a visitor's call still goes
import { asBackground } from "../../prices/callLog.js";
import { englishSeriesName } from "../../prices/sources/anilist.js";

const realFetch = globalThis.fetch;
let calls = 0;
beforeEach(() => {
  calls = 0;
  globalThis.fetch = (async () => {
    calls++;
    return new Response(
      JSON.stringify({ data: { Media: { title: { english: "Answer" } } } }),
    );
  }) as typeof fetch;
});
afterAll(() => {
  globalThis.fetch = realFetch;
});

test("the background takes its share of AniList a minute, and visitors the rest", async () => {
  const asked = await asBackground(() =>
    Promise.allSettled(
      Array.from({ length: 25 }, (_, i) => englishSeriesName(`背景${i}`)),
    ),
  );
  // twenty reached AniList; the rest were turned away, quietly
  expect(calls).toBe(20);
  const refused = asked.filter((r) => r.status === "rejected");
  expect(refused).toHaveLength(5);
  expect(String((refused[0] as PromiseRejectedResult).reason)).toMatch(
    /kept for visitors/,
  );
  // a visitor's lookup still goes
  await expect(englishSeriesName("訪問者")).resolves.toBe("Answer");
  expect(calls).toBe(21);
});
