// Is there something new for this reader? MangaDex lists English chapters but
// barely knows English volumes (most of its covers are the Japanese editions),
// so English volumes come from our US book catalog. Its covers still tell us
// how far Japan has got, for anyone who wants to know.
import type { FormatedDates } from "./volumeDataFormatter.js";
import { volumeOfChapter } from "./volumeStarts.js";

// what the New tab lists, set by each reader. "next": just the next one, however
// far behind. "within": the next one, once they're within that many of the newest.
// "all": everything that's out, however far behind, as one entry per series
export type RangeMode = "next" | "within" | "all";
export type ReleaseRange = { mode: RangeMode; within: number };
export type ReleaseSettings = { volumes: ReleaseRange; chapters: ReleaseRange };

const MAX_WITHIN = { volumes: 10, chapters: 50 } as const;

// a little room for chapters: someone nearly caught up shouldn't drop off the list
// because a couple came out at once. A volume can be bought however old it is
const DEFAULT_RELEASE_SETTINGS: ReleaseSettings = {
  volumes: { mode: "next", within: 3 },
  chapters: { mode: "within", within: 3 },
};

const toRange = (
  value: unknown,
  kind: keyof ReleaseSettings,
): ReleaseRange | null => {
  const { mode, within } = (value ?? {}) as Partial<ReleaseRange>;
  if (mode !== "next" && mode !== "within" && mode !== "all") return null;
  if (!Number.isInteger(within)) return null;
  if (within! < 1 || within! > MAX_WITHIN[kind]) return null;
  return { mode, within: within! };
};

// what's stored, or the defaults for anything missing or malformed
export const readReleaseSettings = (stored: unknown): ReleaseSettings => {
  const { volumes, chapters } = (stored ?? {}) as Partial<ReleaseSettings>;
  return {
    volumes: toRange(volumes, "volumes") ?? DEFAULT_RELEASE_SETTINGS.volumes,
    chapters:
      toRange(chapters, "chapters") ?? DEFAULT_RELEASE_SETTINGS.chapters,
  };
};

// for saving: null if any of it isn't valid
export const validReleaseSettings = (
  value: unknown,
): ReleaseSettings | null => {
  const { volumes, chapters } = (value ?? {}) as Partial<ReleaseSettings>;
  const parsed = {
    volumes: toRange(volumes, "volumes"),
    chapters: toRange(chapters, "chapters"),
  };
  return parsed.volumes && parsed.chapters
    ? { volumes: parsed.volumes, chapters: parsed.chapters }
    : null;
};

// what to store after a lookup: only a real answer that differs. A lookup that found
// nothing mustn't wipe what we already know
export const chapterToSave = (
  found: number | null,
  saved: number | null,
): number | null => (found != null && found !== saved ? found : null);

export type ReleaseStatus = {
  hasNewVolume: boolean;
  hasNewChapter: boolean;
  hasNewJapaneseVolume: boolean;
  // how their settings ask for each to be listed
  volumeMode: RangeMode;
  chapterMode: RangeMode;
  // on the New tab but for "Hide": listed and not new means they've hidden it
  volumeListed: boolean;
  chapterListed: boolean;
  japanListed: boolean;
  // the panel on the details page: they're on the volume right before the newest
  isNextVolumeOut: boolean;
  // how far they've got: what they own, or else the volume their chapter is in
  currentVolume: number | null;
  latestVolume: number | null;
  // the chapter after theirs, up to the latest
  nextChapter: number | null;
  // the next English volume after where they are, and its price page
  nextVolume: number | null;
  nextVolumeBook: { isbn13: string; title: string } | null;
  // every English volume past where they are, for the grouped entry
  outVolumes: { volume: number; isbn13?: string; title?: string }[];
  // the same for what's only out in Japan
  outJapanVolumes: number[];
  latestChapter: number | null;
  latestJapaneseVolume: number | null;
  // when the newest of each came out, where the source says: the New tab's
  // "Just out" pile
  latestVolumeDate: string | null;
  latestChapterDate: string | null;
  latestJapaneseVolumeDate: string | null;
};

type Shelved = {
  volumesOwned: number | null;
  bookmark: number | null;
  // their place kept by the volume: no chapter news, and the volume they've
  // read stands in for a blank shelf
  byVolume?: boolean;
  readVolume?: number | null;
  // the newest they've said "Seen it" to; only something newer counts as new
  seenVolume?: number | null;
  seenChapter?: number | null;
  seenJapanVolume?: number | null;
  // hidden one at a time
  hiddenVolumes?: number[];
};

type Sources = {
  dates: FormatedDates | null; // MangaDex, for chapters
  // the US catalog; null if it didn't answer
  englishVolumes:
    | {
        volume: number | null;
        isbn13?: string;
        title?: string;
        // "2026-11-17", or "2026-11" when only the month is known
        published?: string;
      }[]
    | null;
};

// "New" is what's next for this reader: the next volume they can buy, however far
// behind the newest that is, and the next chapter once they've nearly caught up. A blank shelf number can't say they've caught
// up, so it doesn't count (a blank volume falls back on the chapter they're on)
export function getReleaseStatus(
  {
    volumesOwned,
    bookmark: chapter0,
    byVolume,
    readVolume,
    seenVolume,
    seenChapter,
    seenJapanVolume,
    hiddenVolumes,
  }: Shelved,
  { dates, englishVolumes }: Sources,
  { volumes, chapters }: ReleaseSettings = DEFAULT_RELEASE_SETTINGS,
): ReleaseStatus {
  // read by the volume: the chapter number says nothing
  const bookmark = byVolume ? null : chapter0;
  const numbers = (englishVolumes ?? [])
    .map((v) => v.volume)
    .filter((v): v is number => v != null);
  const latestVolume = numbers.length ? Math.max(...numbers) : null;
  const chapter = parseFloat(
    dates?.chapter?.latestReleased.chapterNumber ?? "",
  );
  const latestChapter = Number.isFinite(chapter) ? chapter : null;
  const nextChapter =
    latestChapter != null &&
    bookmark != null &&
    bookmark > 0 &&
    bookmark < latestChapter
      ? Math.min(Math.floor(bookmark) + 1, latestChapter)
      : null;
  const japanese = (dates?.volume ?? [])
    .map((v) => parseFloat(v.volume ?? ""))
    .filter(Number.isFinite);
  const latestJapaneseVolume = japanese.length ? Math.max(...japanese) : null;
  const currentVolume =
    volumesOwned ||
    (byVolume ? readVolume || null : null) ||
    volumeOfChapter(bookmark, dates?.volumeStarts ?? []);
  const nextVolume =
    currentVolume != null
      ? (numbers.filter((v) => v > currentVolume).sort((a, b) => a - b)[0] ??
        null)
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

  const outVolumes =
    currentVolume != null
      ? (englishVolumes ?? [])
          .filter(
            (v): v is typeof v & { volume: number } =>
              v.volume != null && v.volume > currentVolume,
          )
          .sort((a, b) => a.volume - b.volume)
      : [];
  const isHidden = (volume: number) =>
    volume <= (seenVolume ?? 0) || (hiddenVolumes ?? []).includes(volume);

  const volumeListed =
    nextVolume != null &&
    (volumes.mode !== "within" ||
      (latestVolume ?? 0) - (currentVolume ?? 0) <= volumes.within);
  const hasNewVolume =
    volumes.mode === "all"
      ? outVolumes.some((v) => !isHidden(v.volume))
      : volumeListed && !isHidden(nextVolume);

  const chapterListed =
    // a finished series has nothing new to come
    !dates?.seriesFinished &&
    nextChapter != null &&
    latestChapter != null &&
    (chapters.mode !== "within" ||
      latestChapter - (bookmark ?? 0) <= chapters.within);
  const hasNewChapter =
    chapterListed &&
    // grouped, hiding only part of the way still leaves the rest to show
    (chapters.mode === "all" ? latestChapter! : nextChapter!) >
      (seenChapter ?? 0);

  const pastBoth = Math.max(currentVolume ?? 0, latestVolume ?? 0);
  const outJapanVolumes = [...new Set(japanese)]
    .filter((v) => v > pastBoth)
    .sort((a, b) => a - b);
  const japanListed =
    // without the catalog we can't say it isn't out in English already
    englishVolumes != null &&
    currentVolume != null &&
    latestJapaneseVolume != null &&
    latestJapaneseVolume > pastBoth &&
    (volumes.mode === "next"
      ? // it's next in line only once they've reached the end of what's in English
        caughtUpWithEnglish
      : volumes.mode === "all" ||
        latestJapaneseVolume - currentVolume <= volumes.within);

  return {
    hasNewVolume,
    hasNewChapter,
    hasNewJapaneseVolume:
      japanListed && latestJapaneseVolume! > (seenJapanVolume ?? 0),
    volumeMode: volumes.mode,
    chapterMode: chapters.mode,
    volumeListed,
    chapterListed,
    japanListed,
    outVolumes,
    outJapanVolumes,
    isNextVolumeOut,
    currentVolume,
    latestVolume,
    nextChapter,
    nextVolume,
    nextVolumeBook,
    latestChapter,
    latestJapaneseVolume,
    latestVolumeDate:
      (englishVolumes ?? []).find((v) => v.volume === latestVolume)
        ?.published ?? null,
    latestChapterDate: dates?.chapter?.latestReleased.releaseDate ?? null,
    // covers of the volume come in every language, uploaded as they appear:
    // the first is the nearest to when it came out in Japan
    latestJapaneseVolumeDate:
      (dates?.volume ?? [])
        .filter(
          (v) =>
            parseFloat(v.volume ?? "") === latestJapaneseVolume &&
            Number.isFinite(Date.parse(v.releaseDate ?? "")),
        )
        .map((v) => v.releaseDate!)
        .sort((a, b) => Date.parse(a) - Date.parse(b))[0] ?? null,
  };
}
