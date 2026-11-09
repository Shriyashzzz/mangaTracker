// A volume's prices, by source group (models/priceQueries.ts): each group's
// last check replaces only that group's prices, a store's own listing wins
// over Google Shopping's row for it, and the shelf, series and home page
// prices all read the same "prices now". No price search is ever made here.
import priceQueries from "../../models/priceQueries.js";
import { freshForMs, groupOf } from "../../prices/service.js";
import type { Offer } from "../../prices/types.js";
import { closeDb, prisma } from "./testDb.js";

// a test book of its own, removed before and after (its prices go with it)
const ISBN = "9781999999993";
const removeBook = () => prisma.book.deleteMany({ where: { isbn13: ISBN } });

beforeEach(async () => {
  await removeBook();
  await prisma.book.create({
    data: { isbn13: ISBN, title: "Test Series, Vol. 1" },
  });
});
afterAll(async () => {
  await removeBook();
  await closeDb();
});

const offer = (over: Partial<Offer>): Offer => ({
  store: "Kinokuniya",
  format: "print",
  condition: "new",
  priceCents: 1200,
  currency: "USD",
  inStock: true,
  url: "https://kinokuniya.example/book",
  ...over,
});

const prices = async () =>
  (await priceQueries.getCurrentOffers(ISBN)).map(
    (o) => `${o.store} ${o.condition} ${o.priceCents}`,
  );

const tick = () => new Promise((r) => setTimeout(r, 5));

test("a group's new check replaces only that group's prices", async () => {
  await priceQueries.saveCheck(
    ISBN,
    ["serpapi", "ebay"],
    new Map([
      ["shopping", [offer({})]],
      [
        "ebay",
        [
          offer({
            store: "eBay",
            priceCents: 900,
            url: "https://www.ebay.com/itm/1",
          }),
        ],
      ],
    ]),
  );
  await tick();
  // three days on, only eBay looks again
  await priceQueries.saveCheck(
    ISBN,
    ["ebay"],
    new Map([
      [
        "ebay",
        [
          offer({
            store: "eBay",
            priceCents: 800,
            url: "https://www.ebay.com/itm/2",
          }),
        ],
      ],
    ]),
  );
  expect(await prices()).toEqual(["eBay new 800", "Kinokuniya new 1200"]);
  const checks = await priceQueries.getSourceChecks(ISBN);
  expect([...checks.keys()].sort()).toEqual(["ebay", "shopping"]);
  expect(checks.get("ebay")!.getTime()).toBeGreaterThan(
    checks.get("shopping")!.getTime(),
  );
});

test("a group that looked and found nothing clears its old prices", async () => {
  await priceQueries.saveCheck(
    ISBN,
    ["serpapi"],
    new Map([["shopping", [offer({})]]]),
  );
  await tick();
  await priceQueries.saveCheck(ISBN, [], new Map([["shopping", []]]));
  expect(await prices()).toEqual([]);
});

test("a store's own listing wins over Google Shopping's row for that store", async () => {
  await priceQueries.saveCheck(
    ISBN,
    ["serpapi", "serpapi-amazon"],
    new Map([
      [
        "shopping",
        [
          offer({
            store: "Amazon",
            priceCents: 1000,
            url: "https://www.google.com/shopping/x",
          }),
        ],
      ],
      [
        "amazon",
        [
          offer({
            store: "Amazon",
            priceCents: 1100,
            url: "https://www.amazon.com/dp/1",
          }),
        ],
      ],
    ]),
  );
  const [only] = await priceQueries.getCurrentOffers(ISBN);
  expect(only?.url).toBe("https://www.amazon.com/dp/1");
  expect(await prices()).toEqual(["Amazon new 1100"]);
});

test("shelf and series prices read the prices now, across groups", async () => {
  await priceQueries.saveCheck(
    ISBN,
    ["serpapi"],
    new Map([["shopping", [offer({ priceCents: 1300 })]]]),
  );
  await tick();
  await priceQueries.saveCheck(
    ISBN,
    ["ebay"],
    new Map([
      [
        "ebay",
        [
          offer({
            store: "eBay",
            priceCents: 1250,
            url: "https://www.ebay.com/itm/3",
          }),
        ],
      ],
    ]),
  );
  const known = (await priceQueries.getKnownPrices([ISBN])).get(ISBN);
  expect(known?.priceCents).toBe(1250);
});

test("eBay looks again after 3 days, the paid searches after 20", () => {
  const DAY = 24 * 60 * 60 * 1000;
  expect(groupOf({ id: "ebay" })).toBe("ebay");
  expect(groupOf({ id: "serpapi-ebay" })).toBe("ebay");
  expect(groupOf({ id: "serpapi" })).toBe("shopping");
  expect(groupOf({ id: "serpapi-amazon" })).toBe("amazon");
  expect(freshForMs("ebay")).toBe(3 * DAY);
  expect(freshForMs("shopping")).toBe(20 * DAY);
  expect(freshForMs("amazon")).toBe(20 * DAY);
});
