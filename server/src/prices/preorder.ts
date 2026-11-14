// A volume that isn't out yet ("2027-03-30" from Google Books): it can be
// preordered, but no store has prices worth paying a search for, so its
// pages skip the paid price checks and offer the preorder links instead
// the release date when it's still to come, else null. "2027-03" counts from
// the first of the month
export function notOutYet(published?: string | null, now = new Date()) {
  if (!published) return null;
  const [y, m, d] = published.split("-").map(Number);
  if (!y || !m) return null;
  return new Date(Date.UTC(y, m - 1, d || 1)) > now ? published : null;
}

// A date still to come on a volume that later volumes have already passed
// is a new printing of that volume, not its release: Blue Lock's vol. 16
// was listed for December 2026 with vols. 17 to 37 long out, and every page
// then called it "coming". Such a date is dropped, so the volume counts as
// out everywhere. Applied where a series' list is saved and where it's read
// (savedVolumes.ts, collector/shelfSeries.ts). Anything that isn't a volume
// with a number passes through untouched
export function withoutReprintDates<T>(volumes: T[], now = new Date()): T[] {
  type Dated = { volume?: number | null; published?: string | null };
  const numberOf = (item: T) => {
    const volume = (item as Dated | null)?.volume;
    return typeof volume === "number" ? volume : null;
  };
  const isComing = (item: T) =>
    notOutYet((item as Dated | null)?.published, now) !== null;
  // the furthest volume that's out
  let furthestOut = -Infinity;
  for (const item of volumes) {
    const volume = numberOf(item);
    if (volume !== null && !isComing(item))
      furthestOut = Math.max(furthestOut, volume);
  }
  return volumes.map((item) => {
    const volume = numberOf(item);
    if (volume === null || volume >= furthestOut || !isComing(item))
      return item;
    const undated = { ...(item as T & Dated) };
    delete undated.published;
    return undated as T;
  });
}
