// What a To buy list adds up to (toBuy/toBuy.ts)
import { toBuyTotals } from "../toBuy/toBuy.js";

const price = (cents: number) => ({ cents, store: "eBay" });

test("each kind is added up over the volumes that have that price", () => {
  const totals = toBuyTotals([
    { new: price(999), used: price(500) },
    { new: price(1199), used: null },
    { new: null, used: null },
  ]);
  expect(totals).toEqual({
    volumes: 3,
    new: { cents: 2198, volumes: 2 },
    used: { cents: 500, volumes: 1 },
  });
});

test("an empty list costs nothing", () => {
  expect(toBuyTotals([])).toEqual({
    volumes: 0,
    new: { cents: 0, volumes: 0 },
    used: { cents: 0, volumes: 0 },
  });
});
