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

// a few chapters' grace: a reader who was caught up shouldn't drop off the list
// because two came out in the same fortnight
const CAUGHT_UP_CHAPTERS = 3;

// "New" is for readers who've caught up: the release is next for them, not one
// of dozens they haven't reached. A blank shelf number can't say they've caught
// up, so it doesn't count (a blank volume falls back on the chapter they're on)
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
  const currentVolume =
    volumesOwned || volumeOfChapter(bookmark, dates?.volumeStarts ?? []);
  const isNextVolumeOut =
    latestVolume != null &&
    currentVolume != null &&
    currentVolume >= latestVolume - 1 &&
    currentVolume < latestVolume;
  // they've reached the end of what's in English, so Japan is what's next
  const caughtUpWithEnglish =
    currentVolume != null && currentVolume >= (latestVolume ?? 0);

  return {
    hasNewVolume:
      isNextVolumeOut && latestVolume != null && latestVolume > (seenVolume ?? 0),
    hasNewChapter:
      latestChapter != null &&
      bookmark != null &&
      bookmark > 0 &&
      bookmark < latestChapter &&
      latestChapter - bookmark <= CAUGHT_UP_CHAPTERS &&
      latestChapter > (seenChapter ?? 0),
    hasNewJapaneseVolume:
      // without the catalog we can't say it isn't out in English already
      englishVolumes != null &&
      caughtUpWithEnglish &&
      latestJapaneseVolume != null &&
      latestJapaneseVolume > (currentVolume ?? 0) &&
      latestJapaneseVolume > (latestVolume ?? 0) &&
      latestJapaneseVolume > (seenJapanVolume ?? 0),
    isNextVolumeOut,
    currentVolume,
    latestVolume,
    latestChapter,
    latestJapaneseVolume,
  };
}
