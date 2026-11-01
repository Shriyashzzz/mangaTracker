// Is there something new for this reader? Compares what's on their shelf with
// the release dates from MangaDex and the volume count from AniList.
import type { FormatedDates } from "./volumeDataFormatter.js";

export type ReleaseStatus = {
  hasNewVolume: boolean;
  hasNewChapter: boolean;
  latestVolume: number | null;
  latestChapter: number | null;
};

type Shelved = { volumesOwned: number | null; bookmark: number | null };

// the highest real number in a list of MangaDex's text volume/chapter numbers
const highest = (values: (string | null | undefined)[]) => {
  const numbers = values.map((v) => parseFloat(v ?? "")).filter(Number.isFinite);
  return numbers.length ? Math.max(...numbers) : null;
};

// New volume: they own AniList's last volume but MangaDex has a later one.
// AniList has no count for most ongoing series, so then MangaDex alone decides
export function getReleaseStatus(
  { volumesOwned, bookmark }: Shelved,
  dates: FormatedDates,
  anilistMax: number | null,
): ReleaseStatus {
  const latestVolume = highest((dates.volume ?? []).map((v) => v.volume));
  const latestChapter = highest([dates.chapter?.latestReleased.chapterNumber]);
  const owned = volumesOwned ?? 0;

  return {
    hasNewVolume:
      owned > 0 &&
      latestVolume != null &&
      owned < latestVolume &&
      (anilistMax == null || owned >= anilistMax),
    hasNewChapter:
      bookmark != null && latestChapter != null && bookmark < latestChapter,
    latestVolume,
    latestChapter,
  };
}
