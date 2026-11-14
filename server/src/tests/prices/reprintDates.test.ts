// A date still to come on a volume that later volumes have passed is a
// reprint's, not a release's (prices/preorder.ts withoutReprintDates).
import { withoutReprintDates } from "../../prices/preorder.js";

const now = new Date("2026-11-14T12:00:00Z");
const vol = (volume: number | null, published?: string) => ({
  volume,
  ...(published ? { published } : {}),
});

test("a reprint's date is dropped, a real release's is kept", () => {
  const list = [
    vol(15),
    // re-listed for next month, with 17 and 18 long out
    vol(16, "2026-12-29"),
    vol(17, "2023-01-10"),
    vol(18),
    // really coming: nothing after it is out
    vol(19, "2027-02-02"),
    vol(20, "2027-06-01"),
  ];
  expect(withoutReprintDates(list, now)).toEqual([
    vol(15),
    vol(16),
    vol(17, "2023-01-10"),
    vol(18),
    vol(19, "2027-02-02"),
    vol(20, "2027-06-01"),
  ]);
});

test("a list with nothing odd, or of something else, comes back as it is", () => {
  const plain = [vol(1), vol(2, "2020-01-01"), vol(3, "2027-01-01")];
  expect(withoutReprintDates(plain, now)).toEqual(plain);
  // a series not out at all yet
  const allComing = [vol(1, "2027-01-01"), vol(2, "2027-05-01")];
  expect(withoutReprintDates(allComing, now)).toEqual(allComing);
  // saved lists of other shapes pass through
  const other = [{ failed: true }, { key: "deluxe", books: [] }, null];
  expect(withoutReprintDates(other, now)).toEqual(other);
  expect(withoutReprintDates([], now)).toEqual([]);
});
