// Trimmed from real SerpApi responses saved on 2026-11-02: no search is spent here
import { jest } from "@jest/globals";

async function load(env: Record<string, string> = {}) {
  jest.resetModules();
  Object.assign(process.env, env);
  const stores = await import("../prices/providers/serpapiStores.js");
  const links = await import("../prices/storeLinks.js");
  return { ...stores, ...links };
}

afterEach(() => {
  delete process.env.AMAZON_ASSOCIATE_TAG;
  delete process.env.EBAY_CAMPAIGN_ID;
});

const US = "Located in United States";
const listing = (over: object) => ({
  title: "Chainsaw Man, Vol. 6",
  product_id: "406889406962",
  link: "https://www.ebay.com/itm/406889406962?_skw=9781974720712&hash=abc",
  condition: "Pre-Owned",
  location: US,
  shipping: "Free delivery",
  price: { raw: "$6.35", extracted: 6.35 },
  ...over,
});

test("eBay keeps the cheapest new and used copy, with shipping added", async () => {
  const { ebayOffers } = await load();
  const offers = ebayOffers(
    [
      listing({ price: { extracted: 7.03 } }),
      listing({ price: { extracted: 2.25 }, shipping: { extracted: 5.99 } }),
      listing({ condition: "Brand New", price: { extracted: 11 } }),
      listing({ condition: "New (Other)", price: { extracted: 9 } }),
    ],
    "Chainsaw Man, Vol. 6",
  );
  expect(offers.map((o) => [o.condition, o.priceCents])).toEqual([
    ["used", 703],
    ["new", 1100],
  ]);
  expect(offers.every((o) => o.store === "eBay")).toBe(true);
});

test("eBay titles can be worded any way, but not say they're something else", async () => {
  const { ebayOffers } = await load();
  const kept = (title: string, over: object = {}) =>
    ebayOffers([listing({ title, ...over })], "Chainsaw Man, Vol. 6").length;
  expect(kept("Fujimoto Tatsuki Chainsaw Man 6 (Paperback)")).toBe(1);
  expect(kept("Chainsaw Man Manga Set English Volumes 1-21 Paperback")).toBe(0);
  expect(kept("Spy X Family, Vol. 1 and 2 by Endo, Tatsuya")).toBe(0);
  expect(kept("Chainsaw Man Vol. 7")).toBe(0);
  expect(kept("Chainsaw Man Vol.6 Japanese Manga")).toBe(0);
  expect(kept("Fujimoto Chainsaw Man 6 (Paperback) (UK IMPORT)")).toBe(0);
  expect(kept("Chainsaw Man", { location: "Located in India" })).toBe(0);
  expect(kept("Chainsaw Man", { price: { extracted: 900 } })).toBe(0);
  expect(kept("Chainsaw Man", { price: { from: { extracted: 6 } } })).toBe(0);
  expect(kept("Chainsaw Man", { shipping: "Shipping unknown" })).toBe(0);
});

test("eBay rows open the exact listing with our campaign", async () => {
  const { ebayOffers, isAffiliateUrl } = await load({
    EBAY_CAMPAIGN_ID: "1234567890",
  });
  const { url } = ebayOffers([listing({})], "Chainsaw Man, Vol. 6")[0]!;
  expect(url).toContain("https://www.ebay.com/itm/406889406962?");
  expect(url).toContain("campid=1234567890");
  expect(url).not.toContain("_skw");
  expect(isAffiliateUrl(url)).toBe(true);
});

test("the ISBN-10 is worked out, check digit X included", async () => {
  const { isbn10Of } = await load();
  expect(isbn10Of("9781974720712")).toBe("1974720713");
  expect(isbn10Of("9781591169789")).toBe("159116978X");
  expect(isbn10Of("9798855439434")).toBeNull();
});

test("Amazon splits print from Kindle and skips sets and unavailable books", async () => {
  const { amazonOffers, isAffiliateUrl } = await load({
    AMAZON_ASSOCIATE_TAG: "test-20",
  });
  const offers = amazonOffers(
    [
      {
        asin: "159116978X",
        title: "Case Closed, Vol. 7",
        link_clean: "https://www.amazon.com/Case-Closed/dp/159116978X/",
        extracted_price: 9.59,
      },
      {
        asin: "B00F3HGKJK",
        title: "Case Closed, Vol. 7",
        link_clean: "https://www.amazon.com/Case-Closed-ebook/dp/B00F3HGKJK/",
        extracted_price: 6.29,
      },
      { asin: "B0DZCVWV5S", title: "Case Closed, Vol. 7" },
      {
        asin: "B09V77GVFN",
        title: "Case Closed Vol. 1-9 Bundle Set",
        extracted_price: 69.99,
      },
    ],
    "9781591169789",
    "Case Closed, Vol. 7",
  );
  expect(offers.map((o) => [o.format, o.priceCents])).toEqual([
    ["print", 959],
    ["ebook", 629],
  ]);
  expect(offers[0]!.url).toBe("https://www.amazon.com/dp/159116978X?tag=test-20");
  expect(isAffiliateUrl(offers[0]!.url)).toBe(true);
});

test("Amazon's exact ISBN counts even when the title reads differently", async () => {
  const { amazonOffers } = await load();
  const [offer] = amazonOffers(
    [{ asin: "1974720713", title: "Chainsaw Man 6", extracted_price: 8.99 }],
    "9781974720712",
    "Chainsaw Man, Vol. 6",
  );
  expect(offer?.priceCents).toBe(899);
});

test("a store's Google rows go only once it has a direct row", async () => {
  const { preferDirectRows } = await load();
  const google = "https://www.google.com/search?ibp=oshop";
  const rows = [
    { store: "eBay", url: "https://www.ebay.com/itm/1" },
    { store: "eBay - a_seller", url: google },
    { store: "Amazon.com", url: google },
    { store: "Walmart - Seller", url: google },
    { store: "Target", url: google },
  ];
  expect(preferDirectRows(rows).map((o) => o.store)).toEqual([
    "eBay",
    "Amazon.com",
    "Walmart - Seller",
    "Target",
  ]);
  const withAmazon = [...rows, { store: "Amazon", url: "https://www.amazon.com/dp/1" }];
  expect(preferDirectRows(withAmazon).map((o) => o.store)).not.toContain("Amazon.com");
});
