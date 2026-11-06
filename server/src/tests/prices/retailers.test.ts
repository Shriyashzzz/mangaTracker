// Which "new" copies are believed. A wrong call either puts a fake price in
// the headline and history, or hides a real comic shop's copy
import {
  dropUnlikelyNew,
  isRetailer,
  lowestBelievableNew,
} from "../../prices/stores/retailers.js";
import type { Offer } from "../../prices/types.js";

const offer = (
  store: string,
  priceCents: number,
  extra: Partial<Offer> = {},
): Offer => ({
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
  test.each([
    "Barnes & Noble",
    "barnesandnoble.com",
    "Books A Million",
    "Books-A-Million",
    "Target",
    "kinokuniya.com",
    "Blackwell's",
    "Amazon.com",
  ])("%s is a big store", (store) => expect(isRetailer(store)).toBe(true));

  test.each([
    "Walmart - BooksXpress",
    "Amazon.com - Seller",
    "Green Cosmetics OÜ",
    "Third Eye Comics",
  ])("%s is not", (store) => expect(isRetailer(store)).toBe(false));
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
    const result = dropUnlikelyNew([
      offer("Barnes & Noble", 1199),
      offer("Le Maschere Gioielli", 650),
    ]);
    expect(stores(result)).toEqual(["Barnes & Noble"]);
  });

  test("comic shops at normal prices stay", () => {
    const offers = [
      offer("Barnes & Noble", 1199),
      offer("Third Eye Comics", 999),
      offer("Boswell Books", 1199),
    ];
    expect(dropUnlikelyNew(offers)).toEqual(offers);
  });

  test("a big store's sale price is always believed", () => {
    expect(dropUnlikelyNew([offer("Target", 449)])).toHaveLength(1);
  });

  test("with no big store, the volume's usual new price is the yardstick", () => {
    // usually $11.99 new: a $6.50 "new" copy is too good to be true,
    // though it would pass the flat $6 floor
    const offers = [offer("Unknown Shop", 650), offer("Comic Shop", 1099)];
    expect(stores(dropUnlikelyNew(offers, 1199))).toEqual(["Comic Shop"]);
  });

  test("a big store in the check beats the history", () => {
    // B&N's half-off sale makes $6.50 believable today
    const offers = [offer("Barnes & Noble", 600), offer("Comic Shop", 650)];
    expect(dropUnlikelyNew(offers, 1199)).toEqual(offers);
  });

  test("cheap used and marketplace copies are never judged", () => {
    const offers = [
      offer("eBay", 300, { condition: "marketplace" }),
      offer("Some Shop", 350, { condition: "used" }),
    ];
    expect(dropUnlikelyNew(offers)).toEqual(offers);
  });
});

describe("overpriced new copies", () => {
  const stores = (offers: Offer[], usual?: number) =>
    dropUnlikelyNew(offers, usual).map((o) => o.store);
  const used = (store: string, cents: number) =>
    offer(store, cents, { condition: "marketplace" });

  test("a fashion site's $42 goes when a big store sells it for $10", () => {
    expect(stores([offer("Editorialist", 4200), offer("Amazon", 999)])).toEqual(
      ["Amazon"],
    );
  });

  test("with no big store, the other copies are the yardstick", () => {
    const offers = [
      offer("Editorialist", 4200),
      used("AbeBooks.com", 800),
      used("eBay", 1200),
      used("Mercari", 900),
    ];
    expect(stores(offers)).not.toContain("Editorialist");
    expect(stores(offers)).toHaveLength(3);
  });

  test("a price a bit above the rest stays", () => {
    const offers = [offer("Comic Shop", 1600), offer("Amazon", 999)];
    expect(stores(offers)).toContain("Comic Shop");
  });

  test("a deluxe edition stays when everything costs about that", () => {
    const offers = [
      offer("Comic Shop", 4500),
      used("AbeBooks.com", 3200),
      used("eBay", 3800),
    ];
    expect(stores(offers)).toContain("Comic Shop");
    expect(
      stores([offer("Comic Shop", 6000), offer("Barnes & Noble", 4400)]),
    ).toContain("Comic Shop");
  });

  test("nothing to compare it to: only over a normal volume's range goes", () => {
    expect(stores([offer("Comic Shop", 1400)])).toEqual(["Comic Shop"]);
    expect(stores([offer("Editorialist", 4200)])).toEqual([]);
    expect(
      stores([offer("Editorialist", 4200), used("eBay", 800)]),
    ).not.toContain("Editorialist");
  });

  test("its own past prices can't vouch for it", () => {
    expect(stores([offer("Editorialist", 4200)], 4200)).toEqual([]);
  });

  test("big stores are always believed, and only new copies are judged", () => {
    expect(
      stores([offer("Amazon", 26999), offer("Walmart", 999)]),
    ).toHaveLength(2);
    expect(stores([used("eBay", 9000), offer("Amazon", 999)])).toContain(
      "eBay",
    );
  });

  test("cheap used copies can't make a real new copy look too dear", () => {
    const result = dropUnlikelyNew([
      offer("ThriftBooks", 450, { condition: "used" }),
      offer("eBay", 500, { condition: "used" }),
      offer("Comic Shop", 1199),
    ]);
    expect(stores(result)).toEqual(["ThriftBooks", "eBay", "Comic Shop"]);
  });

  test("ebooks don't count as the other copies", () => {
    const offers = [
      offer("Comic Shop", 1400),
      offer("Kindle", 500, { format: "ebook" }),
      offer("Kobo", 500, { format: "ebook" }),
    ];
    expect(stores(offers)).toContain("Comic Shop");
  });
});

describe("lowestBelievableNew", () => {
  test("skips a fake low price and anything that isn't new print", () => {
    const low = lowestBelievableNew([
      offer("Barnes & Noble", 1099),
      offer("Green Cosmetics OÜ", 400),
      offer("ThriftBooks", 300, { condition: "used" }),
      offer("Kindle", 500, { format: "ebook" }),
    ]);
    expect(low).toBe(1099);
  });

  test("nothing believable leaves no price", () => {
    expect(lowestBelievableNew([offer("Green Cosmetics OÜ", 400)])).toBeNull();
    expect(
      lowestBelievableNew([offer("ThriftBooks", 300, { condition: "used" })]),
    ).toBeNull();
  });
});
