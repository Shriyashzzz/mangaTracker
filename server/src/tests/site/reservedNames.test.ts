// display names that would pass as the site speaking are refused
import { isReservedName } from "../../controllers/accountController.js";

test("the site's own names are kept, however they're written", () => {
  expect(isReservedName("Admin")).toBe(true);
  expect(isReservedName("Manga Tracker")).toBe(true);
  expect(isReservedName("KENJI")).toBe(true);
  expect(isReservedName(" support ")).toBe(true);
  expect(isReservedName("Guts")).toBe(false);
  expect(isReservedName("Kenji fan")).toBe(false);
});
