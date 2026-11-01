// Is there something new for this reader? MangaDex lists English chapters but
// barely knows English volumes (most of its covers are the Japanese editions),
// so English volumes come from our US book catalog. Its covers still tell us
// how far Japan has got, for anyone who wants to know.
import type { FormatedDates } from "./volumeDataFormatter.js";
import { volumeOfChapter } from "./volumeStarts.js";

export type ReleaseStatus = {
  hasNewVolume: boolean;
  hasNewChapter: boolean;
  hasNewJapaneseVolume: boolean;
  // the panel on the details page: they're on the volume right before the newest
  isNextVolumeOut: boolean;
  // how far they've got: what they own, or else the volume their chapter is in
  currentVolume: number | null;
  latestVolume: number | null;
  latestChapter: number | null;
  latestJapaneseVolume: number | null;
};

type Shelved = {
  volumesOwned: number | null;
  bookmark: number | null;
  // the newest they've said "Seen it" to; only something newer counts as new
  seenVolume?: number | null;
  seenChapter?: number | null;
  seenJapanVolume?: number | null;
};

type Sources = {
  dates: FormatedDates | null; // MangaDex, for chapters
  englishVolumes: { volume: number | null }[] | null; // the US catalog; null if it didn't answer
};

// The shelf can only rule something out when it says they're already past it:
// plenty of people read without owning, or never fill these numbers in. So a
// blank counts as nothing yet
export function getReleaseStatus(
  { volumesOwned, bookmark, seenVolume, seenChapter, seenJapanVolume }: Shelved,
  { dates, englishVolumes }: Sources,
): ReleaseStatus {
  const numbers = (englishVolumes ?? [])
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
  const currentVolume =
    volumesOwned || volumeOfChapter(bookmark, dates?.volumeStarts ?? []);

  return {
    hasNewVolume:
      latestVolume != null &&
      owned < latestVolume &&
      latestVolume > (seenVolume ?? 0),
    hasNewChapter:
      latestChapter != null &&
      (bookmark ?? 0) < latestChapter &&
      latestChapter > (seenChapter ?? 0),
    // past what they own, and not just a volume that's already out in English
    hasNewJapaneseVolume:
      // without the catalog we can't say it isn't out in English already
      englishVolumes != null &&
      latestJapaneseVolume != null &&
      latestJapaneseVolume > owned &&
      latestJapaneseVolume > (latestVolume ?? 0) &&
      latestJapaneseVolume > (seenJapanVolume ?? 0),
    isNextVolumeOut:
      latestVolume != null &&
      currentVolume != null &&
      currentVolume >= latestVolume - 1 &&
      currentVolume < latestVolume,
    currentVolume,
    latestVolume,
    latestChapter,
    latestJapaneseVolume,
  };
}
