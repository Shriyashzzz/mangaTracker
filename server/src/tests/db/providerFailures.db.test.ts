// A store that failed for a volume waits before it's asked again
// (prices/volumeService.ts noteFailure): a day after an error, an hour
// after it only took too long, so a slow day doesn't leave the volume
// without that store's price until tomorrow
import { failedRecently, noteFailure } from "../../prices/volumeService.js";
import { closeDb } from "./testDb.js";

afterAll(closeDb);

const MIN = 60_000;
const NOW = Date.now();

test("a store that took too long is asked again after an hour", () => {
  const store = { id: "books-a-million" };
  noteFailure("9781999999801", store, true, NOW);
  expect(failedRecently("9781999999801", store, NOW + 30 * MIN)).toBe(true);
  expect(failedRecently("9781999999801", store, NOW + 61 * MIN)).toBe(false);
});

test("a store that failed waits a day", () => {
  const store = { id: "better-world-books" };
  noteFailure("9781999999802", store, false, NOW);
  expect(failedRecently("9781999999802", store, NOW + 61 * MIN)).toBe(true);
  expect(failedRecently("9781999999802", store, NOW + 25 * 60 * MIN)).toBe(
    false,
  );
  // another volume isn't held back by it
  expect(failedRecently("9781999999803", store, NOW)).toBe(false);
});
