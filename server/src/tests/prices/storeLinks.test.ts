// Affiliate links are money: check they're added only where they should be
import { jest } from "@jest/globals";

const isbn = "9781974725762";

async function load(env: Record<string, string>) {
  jest.resetModules();
  Object.assign(process.env, env);
  return import("../../prices/stores/storeLinks.js");
}

afterEach(() => {
  delete process.env.AMAZON_ASSOCIATE_TAG;
  delete process.env.EBAY_CAMPAIGN_ID;
  delete process.env.BOOKSHOP_AFFILIATE_ID;
  delete process.env.CJ_WEBSITE_ID;
  delete process.env.BETTER_WORLD_BOOKS_LINK;
});

test("Better World Books goes through our Impact link, to the book's own page", async () => {
  const ours = "https://betterworldbooks.pxf.io/c/111/222/333";
  const { affiliateOfferUrl, isAffiliateUrl, storeLinks } = await load({
    BETTER_WORLD_BOOKS_LINK: ours,
  });
  const page = `https://www.betterworldbooks.com/search/results?q=${isbn}`;
  const expected = `${ours}?u=${encodeURIComponent(page)}`;
  const link = storeLinks(isbn).find((l) => l.store === "Better World Books")!;
  expect(link).toEqual({
    store: "Better World Books",
    url: expected,
    affiliate: true,
  });
  expect(isAffiliateUrl(link.url)).toBe(true);
  // someone else's Impact link isn't ours
  expect(
    isAffiliateUrl("https://betterworldbooks.pxf.io/c/999/222/333?u=x"),
  ).toBe(false);

  // a Google Shopping row for it goes there too, new or used: its page for
  // an ISBN lists every copy
  const google = "https://www.google.com/shopping/product/123";
  const offer = { store: "Better World Books", url: google, format: "print" };
  expect(affiliateOfferUrl({ ...offer, condition: "used" }, isbn)).toBe(
    expected,
  );
  // an ebook has its own ISBN
  expect(
    affiliateOfferUrl({ ...offer, format: "ebook", condition: "new" }, isbn),
  ).toBe(google);
});

test("without the setting, Better World Books is a plain link", async () => {
  const { isAffiliateUrl, storeLinks } = await load({});
  const link = storeLinks(isbn).find((l) => l.store === "Better World Books")!;
  expect(link.url).toBe(
    `https://www.betterworldbooks.com/search/results?q=${isbn}`,
  );
  expect(link.affiliate).toBe(false);
  expect(isAffiliateUrl(link.url)).toBe(false);
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

test("Bookshop links follow its format: /a/<affiliate id>/<isbn>", async () => {
  const { affiliateOfferUrl, isAffiliateUrl, storeLinks } = await load({
    BOOKSHOP_AFFILIATE_ID: "130460",
  });
  const expected = `https://bookshop.org/a/130460/${isbn}`;
  const link = storeLinks(isbn).find((l) => l.store === "Bookshop.org")!;
  expect(link.url).toBe(expected);
  expect(isAffiliateUrl(link.url)).toBe(true);

  const google = "https://www.google.com/shopping/product/123";
  const offer = { store: "Bookshop.org", url: google, condition: "new" };
  expect(affiliateOfferUrl({ ...offer, format: "print" }, isbn)).toBe(expected);
  // an ebook has its own ISBN, so the print one would open the wrong book
  expect(affiliateOfferUrl({ ...offer, format: "ebook" }, isbn)).toBe(google);
});

test("eBay links carry the EPN campaign", async () => {
  const { storeLinks } = await load({ EBAY_CAMPAIGN_ID: "5339000000" });
  const ebay = storeLinks(isbn).find((l) => l.store === "eBay")!;
  expect(new URL(ebay.url).searchParams.get("campid")).toBe("5339000000");
});

test("someone else's tag on a store link is swapped for ours, or taken off", async () => {
  const { ourTags, isAffiliateUrl } = await load({
    AMAZON_ASSOCIATE_TAG: "ours-20",
    EBAY_CAMPAIGN_ID: "5330000000",
  });
  const amazon = ourTags("https://www.amazon.com/dp/1974725762?tag=other-20")!;
  expect(new URL(amazon).searchParams.get("tag")).toBe("ours-20");
  expect(isAffiliateUrl("https://www.amazon.com/dp/1?tag=other-20")).toBe(
    false,
  );
  expect(isAffiliateUrl(amazon)).toBe(true);
  const ebay = ourTags("https://www.ebay.com/itm/1?campid=9999999999")!;
  expect(new URL(ebay).searchParams.get("campid")).toBe("5330000000");
  // a lookalike host isn't the store
  expect(isAffiliateUrl("https://notebay.com/itm/1?campid=5330000000")).toBe(
    false,
  );

  const none = await load({});
  delete process.env.AMAZON_ASSOCIATE_TAG;
  delete process.env.EBAY_CAMPAIGN_ID;
  const plain = (await load({})).ourTags(
    "https://www.amazon.com/dp/1?tag=other-20",
  )!;
  expect(new URL(plain).searchParams.has("tag")).toBe(false);
  expect(none.isAffiliateUrl("https://www.amazon.com/dp/1?tag=other-20")).toBe(
    false,
  );
});

test("an eBay listing saved without the campaign gets it when shown", async () => {
  const { ourTags } = await load({ EBAY_CAMPAIGN_ID: "5330000000" });
  const saved =
    "https://www.ebay.com/itm/127644695751?_skw=9781974761319&hash=item1db8377cc7:g:Rl0AAeSwtElpdh92";
  const shown = new URL(ourTags(saved)!);
  expect(shown.searchParams.get("campid")).toBe("5330000000");
  expect(shown.searchParams.get("mkcid")).toBe("1");
  expect(shown.pathname).toBe("/itm/127644695751");
});

test("Books-A-Million links go through CJ with our website ID", async () => {
  const { affiliateOfferUrl, isAffiliateUrl, preferDirectRows, storeLinks } =
    await load({ CJ_WEBSITE_ID: "101919606" });
  const search = `https://www.booksamillion.com/search?query=${isbn}`;
  const expected = `https://www.anrdoezrs.net/links/101919606/type/dlg/${search}`;
  const link = storeLinks(isbn).find((l) => l.store === "Books-A-Million")!;
  expect(link).toMatchObject({ url: expected, affiliate: true });
  expect(isAffiliateUrl(link.url)).toBe(true);
  // CJ's click link from the product search is ours too; someone else's isn't
  expect(
    isAffiliateUrl("https://www.kqzyfj.com/click-101919606-13599892?url=x"),
  ).toBe(true);
  expect(
    isAffiliateUrl("https://www.kqzyfj.com/click-555-13599892?url=x"),
  ).toBe(false);

  const google = "https://www.google.com/shopping/product/123";
  const row = { store: "Books-A-Million", url: google, format: "print" };
  expect(affiliateOfferUrl({ ...row, condition: "new" }, isbn)).toBe(expected);
  // with its own row from CJ, Google Shopping's for it goes
  const own = {
    store: "Books-A-Million",
    url: "https://www.kqzyfj.com/click-1",
  };
  expect(preferDirectRows([row, own])).toEqual([own]);
});

test("without a CJ website ID, Books-A-Million is a plain search", async () => {
  const { storeLinks } = await load({});
  const link = storeLinks(isbn).find((l) => l.store === "Books-A-Million")!;
  expect(link).toMatchObject({
    url: `https://www.booksamillion.com/search?query=${isbn}`,
    affiliate: false,
  });
});
