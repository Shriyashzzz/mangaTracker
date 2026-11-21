// The .ics file of release dates, saved through the browser (lib/
// addToCalendar.ts builds it; this part needs a page to download from, so
// it's apart, and code that runs outside a browser leaves it out)
import { buildIcs } from "./addToCalendar";
import type { CalendarVolume } from "./collector";

export function downloadIcs(
  volumes: CalendarVolume[],
  fileName: string,
  pageFor: (v: CalendarVolume) => string,
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
