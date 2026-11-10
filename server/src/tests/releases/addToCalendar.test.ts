// Release days into the reader's own calendar (client/src/lib/addToCalendar.ts):
// the Google link and the .ics file every other calendar app takes
import {
  buildIcs,
  eventTitle,
  googleCalendarLink,
  hasDay,
} from "../../../../client/src/lib/addToCalendar.js";
import type { CalendarVolume } from "../../../../client/src/lib/collector.js";

const vol = (over: Partial<CalendarVolume> = {}) =>
  ({
    volume: 22,
    isbn13: "9781974700001",
    title: "Dandadan, Vol. 22",
    coverUrl: null,
    published: "2026-12-01",
    month: "2026-12",
    mangaId: 1,
    name: "Dandadan",
    seriesCover: null,
    owned: false,
    ...over,
  }) as CalendarVolume;
const pageFor = (v: CalendarVolume) =>
  `https://mangatracker.example/prices/${v.isbn13}`;
const NOW = new Date("2026-11-10T12:00:00Z");

test("only a release with a day can go in a calendar", () => {
  expect(hasDay(vol())).toBe(true);
  expect(hasDay(vol({ published: "2026-12" }))).toBe(false);
});

test("the Google link is an all-day event on the release day", () => {
  const url = new URL(googleCalendarLink(vol(), pageFor));
  expect(url.origin + url.pathname).toBe(
    "https://calendar.google.com/calendar/render",
  );
  expect(url.searchParams.get("action")).toBe("TEMPLATE");
  expect(url.searchParams.get("text")).toBe("Dandadan Vol. 22 comes out");
  // all day: the end is the day after
  expect(url.searchParams.get("dates")).toBe("20261201/20261202");
  expect(url.searchParams.get("details")).toContain(pageFor(vol()));
});

test("a release with no volume number is titled by its series", () => {
  expect(eventTitle(vol({ volume: null }))).toBe("Dandadan comes out");
});

test("the .ics file has one all-day event per dated release", () => {
  const ics = buildIcs(
    [
      vol(),
      vol({ isbn13: "9781974700002", volume: 23, published: "2026-12-31" }),
      vol({ isbn13: "9781974700003", published: "2027-01" }),
    ],
    pageFor,
    NOW,
  );
  const lines = ics.split("\r\n");
  expect(lines[0]).toBe("BEGIN:VCALENDAR");
  expect(lines.at(-1)).toBe("END:VCALENDAR");
  expect(lines.filter((l) => l === "BEGIN:VEVENT")).toHaveLength(2);
  expect(lines).toContain("DTSTART;VALUE=DATE:20261201");
  expect(lines).toContain("DTEND;VALUE=DATE:20261202");
  // the last day of the year rolls into the next one
  expect(lines).toContain("DTEND;VALUE=DATE:20270101");
  expect(lines).toContain("UID:9781974700001@mangatracker");
  expect(lines).toContain("DTSTAMP:20261110T120000Z");
  // every line ends CRLF, none is longer than 75 characters
  expect(ics.includes("\n") && !/[^\r]\n/.test(ics)).toBe(true);
  expect(lines.every((l) => l.length <= 75)).toBe(true);
});

test("commas, semicolons and long text are written the way calendars read them", () => {
  const ics = buildIcs(
    [
      vol({
        name: "Spy, Family; and a very long series name that keeps going past the line limit",
      }),
    ],
    pageFor,
    NOW,
  );
  const unfolded = ics.replace(/\r\n /g, "");
  expect(unfolded).toContain(
    String.raw`SUMMARY:Spy\, Family\; and a very long series name that keeps going past the line limit Vol. 22 comes out`,
  );
  expect(ics.split("\r\n").some((l) => l.startsWith(" "))).toBe(true);
});

test("nothing dated, an empty calendar rather than a broken one", () => {
  const ics = buildIcs([vol({ published: "2027-02" })], pageFor, NOW);
  expect(ics).not.toContain("VEVENT");
  expect(ics).toContain("BEGIN:VCALENDAR");
});
