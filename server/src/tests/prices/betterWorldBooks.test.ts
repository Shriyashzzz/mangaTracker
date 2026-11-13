// Better World Books' feed items as prices (providers/betterWorldBooks.ts).
// The items below are as Impact's catalog search returned them.
import { offerFromItem } from "../../prices/providers/betterWorldBooks.js";

const item = {
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
