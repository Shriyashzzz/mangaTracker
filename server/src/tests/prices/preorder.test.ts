// A volume not out yet gets no paid price checks (prices/preorder.ts)
import { pool } from "../../config/prisma.js";
import { notOutYet } from "../../prices/preorder.js";

afterAll(() => pool.end());

const today = new Date("2026-11-07T12:00:00Z");

test("a release date still to come is a preorder", () => {
  // I See You, Aizawa-san! Vol. 1
  expect(notOutYet("2027-03-30", today)).toBe("2027-03-30");
  // only the month known: from the first of it
  expect(notOutYet("2027-01", today)).toBe("2027-01");
});

test("one already out, or no date at all, is priced as usual", () => {
  expect(notOutYet("2026-11-01", today)).toBeNull();
  expect(notOutYet("2014-05", today)).toBeNull();
  expect(notOutYet(undefined, today)).toBeNull();
  expect(notOutYet("soon", today)).toBeNull();
});
