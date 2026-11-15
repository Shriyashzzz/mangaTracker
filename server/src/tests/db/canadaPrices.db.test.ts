// Canadian prices by source group, with a real database: each group's look
// replaces only its own prices, Google Shopping's "eBay" row steps aside for
// eBay.ca's own, and every shared price read gives Canadian prices for
// Canada and never mixes them with US ones. No store is ever called.
import priceQueries from "../../models/priceQueries.js";
import type { Offer } from "../../prices/types.js";
import { closeDb, prisma } from "./testDb.js";

const ISBN = "9781999991999";

const offer = (store: string, cents: number, condition = "new"): Offer => ({
  store,
  format: "print",
  condition: condition as Offer["condition"],
  priceCents: cents,
  currency: "CAD",
  inStock: true,
  url: `https://example.com/${store}/${cents}`,
});

const clear = () =>
  prisma.$transaction([
    prisma.caPriceSample.deleteMany({ where: { isbn13: ISBN } }),
    prisma.caPriceSourceCheck.deleteMany({ where: { isbn13: ISBN } }),
    prisma.caPriceCheck.deleteMany({ where: { isbn13: ISBN } }),
    prisma.priceSample.deleteMany({ where: { isbn13: ISBN } }),
    prisma.priceSourceCheck.deleteMany({ where: { isbn13: ISBN } }),
  ]);

const stores = async () =>
  (await priceQueries.getCurrentOffers(ISBN, "ca"))
    .map((o) => `${o.store} ${o.priceCents}`)
    .sort();

beforeEach(clear);
afterAll(async () => {
  await clear();
  await closeDb();
});

test("an eBay.ca look replaces only eBay.ca's prices", async () => {
  await priceQueries.saveCheck(
    ISBN,
    ["google.ca", "ebay.ca"],
    new Map([
      ["shopping", [offer("Amazon.ca", 1599), offer("Indigo", 1699)]],
      ["ebay", [offer("eBay.ca", 2267, "used")]],
    ]),
    "ca",
  );
  await priceQueries.saveCheck(
    ISBN,
    ["ebay.ca"],
    new Map([["ebay", [offer("eBay.ca", 1900, "used")]]]),
    "ca",
  );
  expect(await stores()).toEqual([
    "Amazon.ca 1599",
    "Indigo 1699",
    "eBay.ca 1900",
  ]);
});

test("Google Shopping's eBay row steps aside once eBay.ca has looked", async () => {
  await priceQueries.saveCheck(
    ISBN,
    ["google.ca"],
    new Map([
      ["shopping", [offer("Amazon.ca", 1599), offer("eBay", 1255, "used")]],
    ]),
    "ca",
  );
  // eBay.ca hasn't looked yet: Google's eBay row is all there is
  expect(await stores()).toEqual(["Amazon.ca 1599", "eBay 1255"]);
  await priceQueries.saveCheck(
    ISBN,
    ["ebay.ca"],
    new Map([["ebay", [offer("eBay.ca", 2267, "used")]]]),
    "ca",
  );
  // one eBay, from eBay itself
  expect(await stores()).toEqual(["Amazon.ca 1599", "eBay.ca 2267"]);
});

test("Canadian prices never show as US ones, nor US ones as Canadian", async () => {
  await priceQueries.saveCheck(
    ISBN,
    ["google.ca"],
    new Map([["shopping", [offer("Amazon.ca", 1599)]]]),
    "ca",
  );
  const canada = await priceQueries.getKnownPrices([ISBN], "ca");
  expect(canada.get(ISBN)?.priceCents).toBe(1599);
  // the US reads have nothing for it
  expect((await priceQueries.getKnownPrices([ISBN])).has(ISBN)).toBe(false);
  expect(await priceQueries.getCurrentOffers(ISBN)).toEqual([]);
  // its cheapest copies and history are Canada's too
  const cheapest = await priceQueries.getCheapestCopies(
    [ISBN],
    undefined,
    "ca",
  );
  expect(cheapest.get(ISBN)?.new?.cents).toBe(1599);
  const history = await priceQueries.getPriceHistory(ISBN, undefined, "ca");
  expect(history.checks).toBe(1);
  expect(history.kinds[0]?.lowCents).toBe(1599);
});

test("each Canadian group's last look is kept", async () => {
  await priceQueries.saveCheck(
    ISBN,
    ["ebay.ca"],
    new Map([["ebay", []]]),
    "ca",
  );
  const looked = await priceQueries.getSourceChecks(ISBN, "ca");
  expect([...looked.keys()]).toEqual(["ebay"]);
  // a look that found nothing still counts as a look
  expect(await stores()).toEqual([]);
});
