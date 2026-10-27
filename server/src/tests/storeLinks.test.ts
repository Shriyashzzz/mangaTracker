// Affiliate links are money: check they're added only where they should be
import { jest } from "@jest/globals";

const isbn = "9781974725762";

async function load(env: Record<string, string>) {
  jest.resetModules();
  Object.assign(process.env, env);
  return import("../prices/storeLinks.js");
}

afterEach(() => {
  delete process.env.AMAZON_ASSOCIATE_TAG;
  delete process.env.EBAY_CAMPAIGN_ID;
});

test("no affiliate settings, no affiliate links", async () => {
  const { storeLinks } = await load({});
  expect(storeLinks(isbn).every((l) => !l.affiliate)).toBe(true);
});

test("Amazon gets the associate tag", async () => {
  const { storeLinks, isAffiliateUrl } = await load({
    AMAZON_ASSOCIATE_TAG: "test-20",
  });
  const amazon = storeLinks(isbn).find((l) => l.store === "Amazon")!;
  expect(amazon.url).toContain("tag=test-20");
  expect(isAffiliateUrl(amazon.url)).toBe(true);
});

test("Google Shopping rows go straight to the affiliate store for new print", async () => {
  const { affiliateOfferUrl } = await load({ AMAZON_ASSOCIATE_TAG: "test-20" });
  const google = "https://www.google.com/shopping/product/123";
  const offer = { store: "Amazon.com", url: google, format: "print" };
  expect(affiliateOfferUrl({ ...offer, condition: "new" }, isbn)).toContain(
    "amazon.com",
  );
  // used copies keep their own link
  expect(affiliateOfferUrl({ ...offer, condition: "used" }, isbn)).toBe(google);
});

test("eBay links carry the EPN campaign", async () => {
  const { storeLinks } = await load({ EBAY_CAMPAIGN_ID: "5339000000" });
  const ebay = storeLinks(isbn).find((l) => l.store === "eBay")!;
  expect(new URL(ebay.url).searchParams.get("campid")).toBe("5339000000");
});
