// Which "new" copies are believed. A wrong call either puts a fake price in
// the headline and history, or hides a real comic shop's copy
import { dropUnlikelyNew, isRetailer } from "../prices/retailers.js";
import type { Offer } from "../prices/types.js";

const offer = (store: string, priceCents: number, extra: Partial<Offer> = {}): Offer => ({
  store,
  format: "print",
  condition: "new",
  priceCents,
  currency: "USD",
  inStock: true,
  url: null,
  ...extra,
});

describe("isRetailer", () => {
  test.each(["Barnes & Noble", "barnesandnoble.com", "Books A Million", "Books-A-Million", "Target", "kinokuniya.com", "Blackwell's", "Amazon.com"])(
    "%s is a big store",
    (store) => expect(isRetailer(store)).toBe(true),
  );

  test.each(["Walmart - BooksXpress", "Amazon.com - Seller", "Green Cosmetics OÜ", "Third Eye Comics"])(
    "%s is not",
    (store) => expect(isRetailer(store)).toBe(false),
  );
});

describe("dropUnlikelyNew", () => {
  const stores = (offers: Offer[]) => offers.map((o) => o.store);

  test("with no big store, an unknown seller's new copy under $6 goes", () => {
    // the real Dandadan Vol. 8 check
    const result = dropUnlikelyNew([
      offer("Green Cosmetics OÜ", 400),
      offer("AbeBooks.com", 467, { condition: "marketplace" }),
      offer("Google Play Books", 699, { format: "ebook" }),
    ]);
    expect(stores(result)).toEqual(["AbeBooks.com", "Google Play Books"]);
  });

  test("an unknown seller far under the big stores goes", () => {
    const result = dropUnlikelyNew([offer("Barnes & Noble", 1199), offer("Le Maschere Gioielli", 650)]);
    expect(stores(result)).toEqual(["Barnes & Noble"]);
  });

  test("comic shops at normal prices stay", () => {
    const offers = [offer("Barnes & Noble", 1199), offer("Third Eye Comics", 999), offer("Boswell Books", 1199)];
    expect(dropUnlikelyNew(offers)).toEqual(offers);
  });

  test("a big store's sale price is always believed", () => {
    expect(dropUnlikelyNew([offer("Target", 449)])).toHaveLength(1);
  });

  test("cheap used and marketplace copies are never judged", () => {
    const offers = [offer("eBay", 300, { condition: "marketplace" }), offer("Some Shop", 350, { condition: "used" })];
    expect(dropUnlikelyNew(offers)).toEqual(offers);
  });
});
