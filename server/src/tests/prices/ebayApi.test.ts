// eBay's own API: the same listing rules as eBay through SerpApi
import { browseOffers, type ItemSummary } from "../../prices/providers/ebay.js";

const item = (over: Partial<ItemSummary>): ItemSummary => ({
  title: "Jujutsu Kaisen, Vol. 1",
  conditionId: "1000",
  price: { value: "9.99", currency: "USD" },
  shippingOptions: [{ shippingCost: { value: "4.00" } }],
  itemWebUrl: "https://www.ebay.com/itm/1",
  ...over,
});

const title = "Jujutsu Kaisen, Vol. 1";

test("price includes shipping, and the cheapest new and used are kept", () => {
  const offers = browseOffers(
    [
      item({}),
      item({ price: { value: "7.50", currency: "USD" } }),
      item({ conditionId: "3000", price: { value: "3.00", currency: "USD" } }),
    ],
    title,
    "US",
  );
  expect(offers.map((o) => [o.condition, o.priceCents])).toEqual(
    expect.arrayContaining([
      ["new", 1150],
      ["used", 700],
    ]),
  );
  expect(offers).toHaveLength(2);
});

test("sets, other volumes, Japanese editions and unknown shipping are left out", () => {
  const offers = browseOffers(
    [
      item({ title: "Jujutsu Kaisen Vol 1-10 Box Set" }),
      item({ title: "Jujutsu Kaisen, Vol. 2" }),
      item({ title: "呪術廻戦 1 Japanese edition" }),
      item({ shippingOptions: [] }),
      item({ itemWebUrl: undefined }),
    ],
    title,
    "US",
  );
  expect(offers).toEqual([]);
});

test("eBay.ca listings are in Canadian dollars, and US-dollar ones are skipped", () => {
  const ca = browseOffers(
    [
      item({
        price: { value: "14.00", currency: "CAD" },
        itemWebUrl: "https://www.ebay.ca/itm/2",
      }),
      item({ price: { value: "9.00", currency: "USD" } }),
    ],
    title,
    "CA",
  );
  expect(ca).toHaveLength(1);
  expect(ca[0]).toMatchObject({
    store: "eBay.ca",
    currency: "CAD",
    priceCents: 1800,
  });
  // Canada's tracking is added where the link is shown, not here
  expect(ca[0]!.url).toBe("https://www.ebay.ca/itm/2");
});
