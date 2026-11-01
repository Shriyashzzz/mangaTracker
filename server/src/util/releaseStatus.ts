// Is there something new in English for this reader? MangaDex lists English
// chapters but barely knows English volumes (most of its covers are the
// Japanese editions), so volumes come from our US book catalog instead.
import type { FormatedDates } from "./volumeDataFormatter.js";

export type ReleaseStatus = {
  hasNewVolume: boolean;
  hasNewChapter: boolean;
  latestVolume: number | null;
  latestChapter: number | null;
};

type Shelved = { volumesOwned: number | null; bookmark: number | null };

type Sources = {
  dates: FormatedDates | null; // MangaDex, for chapters
  englishVolumes: { volume: number | null }[]; // the US catalog
  anilistMax: number | null; // AniList's volume count, if it has one
};

// New volume: they own AniList's last volume but a later one is out in English.
// AniList has no count for most ongoing series, so then the catalog alone decides
export function getReleaseStatus(
  { volumesOwned, bookmark }: Shelved,
  { dates, englishVolumes, anilistMax }: Sources,
): ReleaseStatus {
  const numbers = englishVolumes
    .map((v) => v.volume)
    .filter((v): v is number => v != null);
  const latestVolume = numbers.length ? Math.max(...numbers) : null;
  const chapter = parseFloat(dates?.chapter?.latestReleased.chapterNumber ?? "");
  const latestChapter = Number.isFinite(chapter) ? chapter : null;
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
