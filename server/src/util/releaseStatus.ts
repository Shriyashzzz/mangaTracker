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
  // the next English volume after where they are, and its price page
  nextVolume: number | null;
  nextVolumeBook: { isbn13: string; title: string } | null;
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
  // the US catalog; null if it didn't answer
  englishVolumes:
    | { volume: number | null; isbn13?: string; title?: string }[]
    | null;
};

// "New" is what's next for this reader: the next volume they can buy, however far
// behind the newest that is, and a chapter only once they're one away from it. A blank shelf number can't say they've caught
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
  const nextVolume =
    currentVolume != null
      ? numbers.filter((v) => v > currentVolume).sort((a, b) => a - b)[0] ?? null
      : null;
  const nextBook = (englishVolumes ?? []).find((v) => v.volume === nextVolume);
  const nextVolumeBook =
    nextVolume != null && nextBook?.isbn13
      ? { isbn13: nextBook.isbn13, title: nextBook.title ?? "" }
      : null;
  const isNextVolumeOut =
    latestVolume != null &&
    currentVolume != null &&
    currentVolume >= latestVolume - 1 &&
    currentVolume < latestVolume;
  // they've reached the end of what's in English, so Japan is what's next
  const caughtUpWithEnglish =
    currentVolume != null && currentVolume >= (latestVolume ?? 0);

  return {
    hasNewVolume: nextVolume != null && nextVolume > (seenVolume ?? 0),
    hasNewChapter:
      latestChapter != null &&
      bookmark != null &&
      bookmark > 0 &&
      bookmark < latestChapter &&
      latestChapter - bookmark <= 1 &&
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
    nextVolume,
    nextVolumeBook,
    latestChapter,
    latestJapaneseVolume,
  };
}
