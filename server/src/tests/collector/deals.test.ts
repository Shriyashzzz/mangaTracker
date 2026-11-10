// The stores' sales (collector/deals.ts): hidden once over, links tagged
import { jest } from "@jest/globals";
import { liveDeals, type Deal } from "../../collector/deals.js";

const deal = (ends: string): Deal => ({
  store: "Store",
  text: "20% off",
  url: "https://store.example/manga",
  ends,
});

test("a deal runs through its whole last day, anywhere in the US", () => {
  const deals = [deal("2026-11-30")];
  // the cut is 8am UTC on the 1st: midnight Pacific
  expect(liveDeals(deals, new Date("2026-11-30T23:00:00Z"))).toHaveLength(1);
  expect(liveDeals(deals, new Date("2026-12-01T07:59:00Z"))).toHaveLength(1);
  expect(liveDeals(deals, new Date("2026-12-01T08:00:00Z"))).toHaveLength(0);
});

test("a deal with a bad end date isn't shown", () => {
  expect(liveDeals([deal("soon")], new Date("2026-11-10"))).toEqual([]);
});

async function load(env: Record<string, string>) {
  jest.resetModules();
  Object.assign(process.env, env);
  return import("../../collector/deals.js");
}
afterEach(() => {
  delete process.env.AMAZON_ASSOCIATE_TAG;
  delete process.env.EBAY_CAMPAIGN_ID;
});

test("store links get our tag where we have one", async () => {
  const { dealLink } = await load({
    AMAZON_ASSOCIATE_TAG: "ours-20",
    EBAY_CAMPAIGN_ID: "5330000000",
  });
  const amazon = new URL(dealLink("https://www.amazon.com/b?node=4367"));
  expect(amazon.searchParams.get("tag")).toBe("ours-20");
  const ebay = new URL(dealLink("https://www.ebay.com/b/Manga/1"));
  expect(ebay.searchParams.get("campid")).toBe("5330000000");
  // no program with them: as written
  expect(dealLink("https://www.booksamillion.com/manga")).toBe(
    "https://www.booksamillion.com/manga",
  );
  // nonsense isn't touched
  expect(dealLink("not a link")).toBe("not a link");
});

test("without our tags, links go as written", async () => {
  const { dealLink } = await load({});
  expect(dealLink("https://www.amazon.com/b?node=4367")).not.toContain("tag=");
});
