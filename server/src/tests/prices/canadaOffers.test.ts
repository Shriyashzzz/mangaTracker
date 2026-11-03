// Reading Canadian results, shaped like real SerpApi answers for Chainsaw Man Vol. 1
import { believableOffers, ebayCaOffers, shoppingOffers } from "../../prices/canada/canadaOffers.js";

const TITLE = "Chainsaw Man, Vol. 1";

describe("Google Shopping, Canada", () => {
  const offers = shoppingOffers(
    [
      { source: "Amazon CA", title: "Chainsaw Man - Vol. 1", extracted_price: 15.99, product_link: "a" },
      { source: "Indigo Books & Music", title: "Chainsaw Man, Vol. 1", extracted_price: 13.95 },
      { source: "eBay - otouta_86", title: "Chainsaw Man Vol.1-23 Manga Comics【japanese Origin", extracted_price: 20.94 },
      { source: "Amazon CA", title: "Chainsaw Man 1 (Jump Comics)", extracted_price: 23.64 },
      { source: "Bookbot.com", title: "Chainsaw Man, Vol. 1", extracted_price: 8.9 },
    ],
    TITLE,
  );
  const stores = offers.map((o) => `${o.store} ${o.priceCents}`);

  test("keeps the single English volume from each store, in Canadian dollars", () => {
    expect(stores).toEqual(expect.arrayContaining(["Amazon.ca 1599", "Indigo Books & Music 1395"]));
    expect(offers.every((o) => o.currency === "CAD")).toBe(true);
  });

  test("drops sets and Japanese editions", () => {
    expect(stores.some((s) => s.includes("2094") || s.includes("2364"))).toBe(false);
  });
});

describe("eBay.ca", () => {
  test("adds shipping and drops listings with no shipping price", () => {
    const offers = ebayCaOffers(
      [
        { title: "Chainsaw Man, Vol. 1", product_id: "1", condition: "Pre-Owned", price: { extracted: 10.35 }, shipping: { extracted: 5 } },
        { title: "Chainsaw Man, Vol. 1", product_id: "2", condition: "Brand New", price: { extracted: 12 }, shipping: "Free shipping" },
        { title: "Chainsaw Man, Vol. 1", product_id: "3", price: { extracted: 9 } },
      ],
      TITLE,
    );
    expect(offers.map((o) => [o.condition, o.priceCents, o.url])).toEqual(
      expect.arrayContaining([
        ["used", 1535, "https://www.ebay.ca/itm/1"],
        ["new", 1200, "https://www.ebay.ca/itm/2"],
      ]),
    );
    expect(offers).toHaveLength(2);
  });
});

test("cheapest first, without new copies we don't believe", () => {
  const sorted = believableOffers([
    { store: "Indigo", format: "print", condition: "new", priceCents: 1395, currency: "CAD", inStock: true, url: null },
    { store: "Amazon.ca", format: "print", condition: "new", priceCents: 1599, currency: "CAD", inStock: true, url: null },
    { store: "Odd Seller", format: "print", condition: "new", priceCents: 200, currency: "CAD", inStock: true, url: null },
  ]);
  expect(sorted.map((o) => o.store)).toEqual(["Indigo", "Amazon.ca"]);
});
