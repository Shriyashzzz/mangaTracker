// Release days into the reader's own calendar: a Google Calendar link for one
// release, and an .ics file (Apple Calendar, Outlook and nearly every other
// calendar app open it; Google can import it) for one or all of them. All-day
// events on the day the publisher gives; a release known only to the month
// has no day to put it on, so it's left out
// no imports that reach the network, so the tests can load it: the page
// passes in where a volume's page is (pageFor)
import type { CalendarVolume } from "./collector";

// "Nov 17"
const day = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });

// where a volume's page is, as a full address
type PageFor = (v: CalendarVolume) => string;

export const hasDay = (v: Pick<CalendarVolume, "published">) =>
  /^\d{4}-\d{2}-\d{2}$/.test(v.published);

const compact = (iso: string) => iso.replaceAll("-", "");
// the day after, as calendars end an all-day event
const nextDay = (iso: string) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
};

export const eventTitle = (v: CalendarVolume) =>
  `${v.name}${v.volume !== null ? ` Vol. ${v.volume}` : ""} comes out`;

export function googleCalendarLink(v: CalendarVolume, pageFor: PageFor) {
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: eventTitle(v),
    dates: `${compact(v.published)}/${compact(nextDay(v.published))}`,
    details: `Prices and preorders: ${pageFor(v)}`,
  });
  return `https://calendar.google.com/calendar/render?${params}`;
}

// iCalendar text: commas, semicolons and backslashes escaped, lines folded at
// 75 characters, CRLF line ends (RFC 5545)
const esc = (text: string) =>
  text.replace(/[\\;,]/g, (c) => `\\${c}`).replace(/\r?\n/g, "\\n");
const fold = (line: string) => {
  const out: string[] = [];
  for (let i = 0; i < line.length; i += 74)
    out.push((i ? " " : "") + line.slice(i, i + 74));
  return out.join("\r\n");
};

export function buildIcs(
  volumes: CalendarVolume[],
  pageFor: PageFor,
  now = new Date(),
) {
  const stamp = now.toISOString().replace(/[-:]/g, "").replace(/\.\d+/, "");
  const events = volumes.filter(hasDay).flatMap((v) => [
    "BEGIN:VEVENT",
    // the same release added twice updates rather than doubles
    `UID:${v.isbn13}@mangatracker`,
    `DTSTAMP:${stamp}`,
    `DTSTART;VALUE=DATE:${compact(v.published)}`,
    `DTEND;VALUE=DATE:${compact(nextDay(v.published))}`,
    `SUMMARY:${esc(eventTitle(v))}`,
    `DESCRIPTION:${esc(`Out ${day(v.published)}. Prices and preorders: ${pageFor(v)}`)}`,
    `URL:${pageFor(v)}`,
    "TRANSP:TRANSPARENT",
    "END:VEVENT",
  ]);
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Manga Tracker//Upcoming Releases//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    ...events,
    "END:VCALENDAR",
  ]
    .map(fold)
    .join("\r\n");
}

// saved as a file; opening it offers to add the events
export function downloadIcs(
  volumes: CalendarVolume[],
  fileName: string,
  pageFor: PageFor,
) {
  const blob = new Blob([buildIcs(volumes, pageFor)], {
    type: "text/calendar;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
