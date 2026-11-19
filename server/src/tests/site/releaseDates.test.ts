// Release dates as the app writes them (client/src/lib/releaseDates.ts)
import { formatReleaseDate } from "../../../../client/src/lib/releaseDates.js";

const now = new Date(2026, 10, 19, 12);
test("near days in words, later ones as the rest of the app writes dates", () => {
  expect(formatReleaseDate("2026-11-19T12:00:00", now)).toBe("Today");
  expect(formatReleaseDate("2026-11-20T12:00:00", now)).toBe("Tomorrow");
  expect(formatReleaseDate("2026-11-23T12:00:00", now)).toBe("In 4 days");
  // this year: no year
  expect(formatReleaseDate("2026-12-29T12:00:00", now)).toBe("Dec 29");
  // another year: with it
  expect(formatReleaseDate("2027-01-12T12:00:00", now)).toBe("Jan 12, 2027");
  expect(formatReleaseDate(null, now)).toBeNull();
});
