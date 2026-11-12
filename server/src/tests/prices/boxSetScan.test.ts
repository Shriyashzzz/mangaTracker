import { sampleTitles } from "../../prices/boxSetScan.js";
import { browseOffers, type ItemSummary } from "../../prices/providers/ebay.js";

const vol = (volume: number | null, title = `Naruto, Vol. ${volume}`) => ({
  volume,
  title,
});

test("a scan is read against the first, middle and last volume", () => {
  const all = Array.from({ length: 72 }, (_, i) => vol(i + 1));
  expect(sampleTitles(all)).toEqual([
    "Naruto, Vol. 1",
    "Naruto, Vol. 36",
    "Naruto, Vol. 72",
  ]);
  // a one-volume series is asked about once; halves and specials aren't used
  expect(sampleTitles([vol(1), vol(1.5), vol(0), vol(null, "Naruto")])).toEqual(
    ["Naruto, Vol. 1"],
  );
  expect(sampleTitles([])).toEqual([]);
});

const item = (title: string, price: string): ItemSummary => ({
  title,
  conditionId: "1000",
  price: { value: price, currency: "USD" },
  shippingOptions: [{ shippingCost: { value: "0.00", currency: "USD" } }],
  itemWebUrl: `https://www.ebay.com/itm/${encodeURIComponent(title)}`,
});

test("a search by the series' name keeps its box sets and nothing else", () => {
  const items = [
    item("Naruto Box Set 1: Volumes 1-27 with Premium", "139.99"),
    item("Naruto Box Set 3: Volumes 49-72", "150.00"),
    // a seller's pile of loose volumes isn't a box set
    item("Naruto manga lot vol 1-27 mixed used books", "80.00"),
    // nor is one volume, or a toy
    item("Naruto, Vol. 1", "6.00"),
    item("Naruto Box Set Funko figure", "30.00"),
    // a sequel sharing the name
    item("Boruto: Naruto Next Generations Box Set 1-10", "60.00"),
  ];
  const sets = (title: string) =>
    browseOffers(items, title, "US", "title")
      .filter((o) => o.format === "set")
      .map((o) => o.priceCents);
  // each set is found from a volume it holds
  expect(sets("Naruto, Vol. 1")).toEqual([13999]);
  expect(sets("Naruto, Vol. 72")).toEqual([15000]);
});
