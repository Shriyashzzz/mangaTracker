// The day a tick is recorded by: the reader's own, as their page sends it,
// within a day of the server's (util/shelf/tickedBooks.ts readersDay).
// Times are worked out from the real clock, never fixed
import { readersDay } from "../../util/shelf/tickedBooks.js";

const DAY = 24 * 60 * 60 * 1000;
const dayOf = (at: number) => new Date(at).toISOString().slice(0, 10);

test("their day is used when it's a day either side of the server's", () => {
  const now = new Date();
  expect(readersDay(dayOf(now.getTime()), now)).toBe(dayOf(now.getTime()));
  // Japan's morning is still yesterday in UTC: tomorrow, to the server
  expect(readersDay(dayOf(now.getTime() + DAY), now)).toBe(
    dayOf(now.getTime() + DAY),
  );
  expect(readersDay(dayOf(now.getTime() - DAY), now)).toBe(
    dayOf(now.getTime() - DAY),
  );
});

test("anything else is the server's own day", () => {
  const now = new Date();
  const server = dayOf(now.getTime());
  for (const sent of [
    undefined,
    null,
    42,
    "",
    "2026",
    "not a day",
    dayOf(now.getTime() + 3 * DAY),
    dayOf(now.getTime() - 400 * DAY),
  ])
    expect(readersDay(sent, now)).toBe(server);
});
