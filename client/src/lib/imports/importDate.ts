// When a series was last changed, as an import's source says it: AniList's
// seconds since 1970, Kitsu's and a backup's "2026-03-01T10:00:00Z",
// Goodreads' "2026/03/01", Book Catalogue's "2026-03-01 17:22:26". Read into one form (ISO text) so the shelf's
// "Last updated" order survives the move. Anything that isn't a believable
// day in the past gives undefined, and the import's own time is used.
// No imports, so the server's tests can run it too.

// before this, nobody was keeping a reading list on any of these sites
const EARLIEST = Date.UTC(1995, 0, 1);
// a clock a little off, or another time zone, isn't "the future"
const SLACK_MS = 24 * 60 * 60 * 1000;

// the forms the book apps write, as one a computer reads the same way
// everywhere: Goodreads' "2026/03/01" and Book Catalogue's "2026-03-01
// 17:22:26" (no time zone: taken as UTC, so every browser agrees)
function asIsoText(text: string) {
  const dashed = text.replaceAll("/", "-");
  const dayAndTime = /^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}(?::\d{2})?)$/.exec(
    dashed,
  );
  return dayAndTime ? `${dayAndTime[1]}T${dayAndTime[2]}Z` : dashed;
}

export function importDate(value: unknown, now = Date.now()) {
  let time = NaN;
  // seconds since 1970 (AniList)
  if (typeof value === "number") time = value * 1000;
  // a date as text
  else if (typeof value === "string" && value.trim())
    time = Date.parse(asIsoText(value.trim()));
  if (!Number.isFinite(time)) return undefined;
  if (time < EARLIEST || time > now + SLACK_MS) return undefined;
  return new Date(time).toISOString();
}

// the later of several, for a series made of many books
export function latestDate(dates: (string | undefined)[]) {
  const known = dates.filter((date): date is string => Boolean(date)).sort();
  return known[known.length - 1];
}
