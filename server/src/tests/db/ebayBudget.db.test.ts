// eBay's daily call budget (prices/providers/ebay.ts): counted in api_usage,
// a row a day. eBay itself is never called: fetch is replaced
import { jest } from "@jest/globals";
import config from "../../config/config.js";
import {
  budgetLabel,
  ebayCallsLeft,
  resetEbaySync,
  searchEbay,
} from "../../prices/providers/ebay.js";
import { SearchesUsedUp } from "../../prices/providers/serpapiKeys.js";
import { closeDb, prisma } from "./testDb.js";

const label = budgetLabel;
const setUsed = (calls: number) =>
  prisma.$executeRaw`
    INSERT INTO api_usage (provider, month, calls)
    VALUES (${label()}, date_trunc('month', now())::date, ${calls})
    ON CONFLICT (provider, month) DO UPDATE SET calls = ${calls}`;
const used = async () =>
  (
    await prisma.$queryRaw<{ calls: number }[]>`
      SELECT calls FROM api_usage WHERE provider = ${label()}`
  )[0]?.calls ?? 0;
const clear = () =>
  prisma.$executeRaw`DELETE FROM api_usage WHERE provider = ${label()}`;

const realFetch = globalThis.fetch;
let searches: string[] = [];
// eBay's own count of today's calls, as its rate-limit API gives it
let ebaysCount: number | null = null;
const fakeEbay = (status = 200) => {
  searches = [];
  globalThis.fetch = (async (url: string | URL) => {
    const u = String(url);
    if (u.includes("/oauth2/token"))
      return new Response(
        JSON.stringify({ access_token: "t", expires_in: 7200 }),
      );
    if (u.includes("/rate_limit"))
      return ebaysCount === null
        ? new Response("{}", { status: 500 })
        : new Response(
            JSON.stringify({
              rateLimits: [
                {
                  resources: [
                    { name: "buy.browse", rates: [{ count: ebaysCount }] },
                  ],
                },
              ],
            }),
          );
    searches.push(new URL(u).searchParams.get("q") ?? "");
    return new Response(JSON.stringify({ itemSummaries: [] }), { status });
  }) as typeof fetch;
};

beforeEach(async () => {
  await clear();
  ebaysCount = null;
  resetEbaySync();
});
afterEach(() => {
  globalThis.fetch = realFetch;
});
afterAll(async () => {
  await clear();
  await closeDb();
});

const search = () =>
  searchEbay(
    "9781974710027",
    "Jujutsu Kaisen, Vol. 1",
    "US",
    AbortSignal.timeout(5000),
  );

test("each search takes one call from today's count", async () => {
  fakeEbay();
  await search();
  expect(searches).toHaveLength(3);
  expect(await used()).toBe(3);
});

test("with today's calls used up, eBay isn't asked at all", async () => {
  await setUsed(config.EBAY_DAILY_LIMIT);
  fakeEbay();
  await expect(search()).rejects.toBeInstanceOf(SearchesUsedUp);
  expect(searches).toEqual([]);
  expect(await ebayCallsLeft()).toBe(false);
});

test("past 80%, only the ISBN search runs", async () => {
  await setUsed(Math.floor(config.EBAY_DAILY_LIMIT * 0.8));
  fakeEbay();
  await search();
  expect(searches).toEqual(["9781974710027"]);
});

test("a 429 from eBay marks the day used up", async () => {
  fakeEbay(429);
  jest.spyOn(console, "warn").mockImplementation(() => {});
  await expect(search()).rejects.toBeInstanceOf(SearchesUsedUp);
  expect(await used()).toBeGreaterThanOrEqual(config.EBAY_DAILY_LIMIT);
  expect(await ebayCallsLeft()).toBe(false);
});

test("eBay's own count of today's calls raises ours (other places use the same keys)", async () => {
  ebaysCount = config.EBAY_DAILY_LIMIT;
  fakeEbay();
  await expect(search()).rejects.toBeInstanceOf(SearchesUsedUp);
  expect(searches).toEqual([]);
});

test("if eBay's count can't be read, ours goes on alone", async () => {
  fakeEbay();
  await search();
  expect(searches).toHaveLength(3);
});
