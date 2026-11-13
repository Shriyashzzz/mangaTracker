// Better World Books' feed items as prices (providers/betterWorldBooks.ts).
// The items below are as Impact's catalog search returned them.
import config from "../../config/config.js";
import {
  bestOffer,
  bwbOffers,
  offerFromItem,
} from "../../prices/providers/betterWorldBooks.js";

const item = {
  CampaignName: "Better World Books",
  Gtin: "9781974709939",
  Name: "Chainsaw Man, Vol. 1 by Tatsuki Fujimoto (Paperback)",
  CurrentPrice: "5.96",
  Currency: "USD",
  Condition: "Used",
  StockAvailability: "InStock",
  Url: "https://betterworldbooks.pxf.io/c/1/2/3?prodsku=9781974709939&u=https%3A%2F%2Fwww.betterworldbooks.com%2Fproduct%2Fdetail%2F9781974709939",
};

test("a used copy in stock is a used print price, with the feed's own link", () => {
  expect(offerFromItem(item)).toEqual({
    store: "Better World Books",
    format: "print",
    condition: "used",
    priceCents: 596,
    currency: "USD",
    inStock: true,
    url: item.Url,
  });
});

test("only a copy the feed calls New is new", () => {
  expect(offerFromItem({ ...item, Condition: "New" })?.condition).toBe("new");
  // anything else from a used-book shop is used: never passed off as new
  for (const Condition of ["Used", "Very Good", "", null, undefined])
    expect(offerFromItem({ ...item, Condition })?.condition).toBe("used");
});

test("out of stock is said, and a price that isn't dollars is no price", () => {
  expect(
    offerFromItem({ ...item, StockAvailability: "OutOfStock" })?.inStock,
  ).toBe(false);
  expect(offerFromItem({ ...item, Currency: "CAD" })).toBeNull();
  expect(offerFromItem({ ...item, CurrentPrice: "0.00" })).toBeNull();
  expect(offerFromItem({ ...item, CurrentPrice: "soon" })).toBeNull();
  expect(offerFromItem({ ...item, CurrentPrice: null })).toBeNull();
});

test("a price is kept to the cent", () => {
  expect(offerFromItem({ ...item, CurrentPrice: "7.24" })?.priceCents).toBe(
    724,
  );
  expect(offerFromItem({ ...item, CurrentPrice: "10.1" })?.priceCents).toBe(
    1010,
  );
});

test("listed more than once: the copy in stock, then the cheapest", () => {
  const dear = { ...item, CurrentPrice: "9.00" };
  const cheap = { ...item, CurrentPrice: "5.00" };
  const cheapestButGone = {
    ...item,
    CurrentPrice: "2.00",
    StockAvailability: "OutOfStock",
  };
  expect(bestOffer([dear, cheapestButGone, cheap])?.priceCents).toBe(500);
  expect(bestOffer([cheap, dear])?.priceCents).toBe(500);
  // none in stock: still the cheapest, said to be out of stock
  expect(bestOffer([cheapestButGone])?.inStock).toBe(false);
  expect(bestOffer([{ ...item, CurrentPrice: null }])).toBeNull();
  expect(bestOffer([])).toBeNull();
});

// ---- a whole shelf at once (bwbOffers), with Impact faked: never called

const realFetch = globalThis.fetch;
const keys = {
  IMPACT_ACCOUNT_SID: config.IMPACT_ACCOUNT_SID,
  IMPACT_AUTH_TOKEN: config.IMPACT_AUTH_TOKEN,
};
// Impact's answer, a page for each call, and the paths asked for
let pages: object[] = [];
let asked: string[] = [];
beforeEach(() => {
  Object.assign(config, { IMPACT_ACCOUNT_SID: "sid", IMPACT_AUTH_TOKEN: "t" });
  asked = [];
  globalThis.fetch = (async (url: string | URL) => {
    asked.push(String(url));
    const page = pages[asked.length - 1];
    if (!page) return new Response("no such page", { status: 500 });
    return new Response(JSON.stringify(page));
  }) as typeof fetch;
});
afterEach(() => {
  globalThis.fetch = realFetch;
  Object.assign(config, keys);
});
const forever = new AbortController().signal;
const other = "9781974718719";

test("a shelf's volumes come back by ISBN, only the ones they have", async () => {
  pages = [{ Items: [item] }];
  const offers = await bwbOffers([item.Gtin, other], forever);
  expect([...offers.keys()]).toEqual([item.Gtin]);
  expect(offers.get(item.Gtin)?.priceCents).toBe(596);
  expect(asked).toHaveLength(1);
});

test("another store's book on Impact is never saved as theirs", async () => {
  pages = [{ Items: [{ ...item, CampaignName: "Some Other Store" }] }];
  expect((await bwbOffers([item.Gtin], forever)).size).toBe(0);
});

test("an answer longer than a page is read to its end", async () => {
  pages = [
    {
      Items: [{ ...item, CurrentPrice: "9.00" }],
      "@nextpageuri": "/Mediapartners/sid/Catalogs/ItemSearch?AfterId=abc",
    },
    { Items: [{ ...item, Gtin: other }], "@nextpageuri": "" },
  ];
  const offers = await bwbOffers([item.Gtin, other], forever);
  expect([...offers.keys()].sort()).toEqual([item.Gtin, other].sort());
  expect(asked[1]).toBe(
    "https://api.impact.com/Mediapartners/sid/Catalogs/ItemSearch?AfterId=abc",
  );
});

test('a failed or endless answer is an error, never "they don\'t have it"', async () => {
  pages = [];
  await expect(bwbOffers([item.Gtin], forever)).rejects.toThrow("500");
  const endless = { Items: [], "@nextpageuri": "/Mediapartners/sid/more" };
  pages = Array.from({ length: 10 }, () => endless);
  await expect(bwbOffers([item.Gtin], forever)).rejects.toThrow("too long");
});
