// Is there something new for this reader? MangaDex lists English chapters but
// barely knows English volumes (most of its covers are the Japanese editions),
// so English volumes come from our US book catalog. Its covers still tell us
// how far Japan has got, for anyone who wants to know.
import type { FormatedDates } from "./volumeDataFormatter.js";

export type ReleaseStatus = {
  hasNewVolume: boolean;
  hasNewChapter: boolean;
  hasNewJapaneseVolume: boolean;
  latestVolume: number | null;
  latestChapter: number | null;
  latestJapaneseVolume: number | null;
};

type Shelved = { volumesOwned: number | null; bookmark: number | null };

type Sources = {
  dates: FormatedDates | null; // MangaDex, for chapters
  englishVolumes: { volume: number | null }[]; // the US catalog
};

// The shelf can only rule something out when it says they're already past it:
// plenty of people read without owning, or never fill these numbers in. So a
// blank counts as nothing yet
export function getReleaseStatus(
  { volumesOwned, bookmark }: Shelved,
  { dates, englishVolumes }: Sources,
): ReleaseStatus {
  const numbers = englishVolumes
    .map((v) => v.volume)
    .filter((v): v is number => v != null);
  const latestVolume = numbers.length ? Math.max(...numbers) : null;
  const chapter = parseFloat(dates?.chapter?.latestReleased.chapterNumber ?? "");
  const latestChapter = Number.isFinite(chapter) ? chapter : null;
  const japanese = (dates?.volume ?? [])
    .map((v) => parseFloat(v.volume ?? ""))
    .filter(Number.isFinite);
  const latestJapaneseVolume = japanese.length ? Math.max(...japanese) : null;
  const owned = volumesOwned ?? 0;

  return {
    hasNewVolume: latestVolume != null && owned < latestVolume,
    hasNewChapter: latestChapter != null && (bookmark ?? 0) < latestChapter,
    // past what they own, and not just a volume that's already out in English
    hasNewJapaneseVolume:
      latestJapaneseVolume != null &&
      latestJapaneseVolume > owned &&
      latestJapaneseVolume > (latestVolume ?? 0),
    latestVolume,
    latestChapter,
    latestJapaneseVolume,
  };
}
