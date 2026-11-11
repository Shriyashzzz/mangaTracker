// Books-A-Million through CJ (prices/providers/booksAMillion.ts): the price
// from CJ's product search, and its daily call count in api_usage. CJ itself
// is never called: fetch is replaced
import config from "../../config/config.js";
import booksAMillion, {
  cjBudgetLabel,
  cjCallsLeft,
} from "../../prices/providers/booksAMillion.js";
import { freshForMs } from "../../prices/service.js";
import { SearchesUsedUp } from "../../prices/providers/serpapiKeys.js";
import { closeDb, prisma } from "./testDb.js";

const ISBN = "9781974709939";
const BAM = "129899";
const book = { isbn13: ISBN, title: "Chainsaw Man, Vol. 1" };

const setUsed = (calls: number) =>
  prisma.$executeRaw`
    INSERT INTO api_usage (provider, month, calls)
    VALUES (${cjBudgetLabel()}, ${`${cjBudgetLabel().slice(3, 10)}-01`}::date, ${calls})
    ON CONFLICT (provider, month) DO UPDATE SET calls = ${calls}`;
const clear = () =>
  prisma.$executeRaw`DELETE FROM api_usage WHERE provider = ${cjBudgetLabel()}`;

type Product = Record<string, unknown>;
const product = (over: Product = {}): Product => ({
  advertiserId: BAM,
  gtin: ISBN,
  price: { amount: "11.99", currency: "USD" },
  salePrice: null,
  availability: "in stock",
  link: "https://www.booksamillion.com/p/Chainsaw-Man/Tatsuki-Fujimoto/9781974709939",
  linkCode: { clickUrl: "https://www.kqzyfj.com/click-101-202?url=x" },
  ...over,
});

const realFetch = globalThis.fetch;
let calls = 0;
let sent = "";
const fakeCj = (products: Product[], status = 200) => {
  calls = 0;
  globalThis.fetch = (async (_url: string | URL, init?: RequestInit) => {
    calls++;
    sent = String(init?.body ?? "");
    return new Response(
      JSON.stringify({ data: { products: { resultList: products } } }),
      { status },
    );
  }) as typeof fetch;
};

const saved = { ...config };
beforeAll(() => {
  Object.assign(config, {
    CJ_API_TOKEN: "token",
    CJ_COMPANY_ID: "1",
    CJ_BAM_ID: BAM,
    CJ_WEBSITE_ID: "101",
  });
});
beforeEach(clear);
afterEach(() => {
  globalThis.fetch = realFetch;
});
afterAll(async () => {
  Object.assign(config, saved);
  await clear();
  await closeDb();
});

const search = () =>
  booksAMillion.fetchOffers(ISBN, AbortSignal.timeout(5000), book);

test("Books-A-Million's own copy, new print, through our CJ link", async () => {
  fakeCj([product()]);
  expect(await search()).toEqual([
    {
      store: "Books-A-Million",
      format: "print",
      condition: "new",
      priceCents: 1199,
      currency: "USD",
      inStock: true,
      url: "https://www.kqzyfj.com/click-101-202?url=x",
    },
  ]);
  // asked for Books-A-Million only, with our website ID for the link
  expect(sent).toContain(`partnerIds: [\\"${BAM}\\"]`);
  expect(sent).toContain(`pid: \\"101\\"`);
});

test("a sale price below the list price is the price", async () => {
  fakeCj([product({ salePrice: { amount: "9.59", currency: "USD" } })]);
  expect((await search())[0]?.priceCents).toBe(959);
});

test("other stores, other ISBNs and other currencies are left out", async () => {
  fakeCj([
    product({ advertiserId: "4281592" }),
    product({ gtin: "9781974709953" }),
    product({ price: { amount: "268.00", currency: "CZK" } }),
  ]);
  expect(await search()).toEqual([]);
});

test("out of stock is kept, marked so", async () => {
  fakeCj([product({ availability: "out of stock" })]);
  expect((await search())[0]?.inStock).toBe(false);
});

test("each search takes one call from today's count", async () => {
  fakeCj([product()]);
  await search();
  await search();
  const [row] = await prisma.$queryRaw<{ calls: number }[]>`
    SELECT calls FROM api_usage WHERE provider = ${cjBudgetLabel()}`;
  expect(row?.calls).toBe(2);
});

test("with today's calls used up, CJ isn't asked at all", async () => {
  await setUsed(config.CJ_DAILY_LIMIT);
  fakeCj([product()]);
  await expect(search()).rejects.toBeInstanceOf(SearchesUsedUp);
  expect(calls).toBe(0);
  expect(await cjCallsLeft()).toBe(false);
});

test("a 429 from CJ fails the search, keeping the stored prices", async () => {
  fakeCj([], 429);
  await expect(search()).rejects.toBeInstanceOf(SearchesUsedUp);
});

test("looks again as often as eBay's own API", () => {
  expect(freshForMs(booksAMillion)).toBe(freshForMs({ id: "ebay" }));
});
