// Is there something new for this reader? MangaDex lists English chapters but
// barely knows English volumes (most of its covers are the Japanese editions),
// so English volumes come from our US book catalog. Its covers still tell us
// how far Japan has got, for anyone who wants to know.
import type { FormatedDates } from "./volumeDataFormatter.js";
import {
  chaptersAcross,
  chaptersIn,
  volumeOfChapter,
  volumeSurelyHolding,
} from "./volumeStarts.js";

type InBook = { book: number; from: number; to: number };

// which series the New tab lists, set by each reader. "next": every series,
// with the next one for it, however far behind. "within": only once they're
// within that many of the newest
export type RangeMode = "next" | "within";
export type ReleaseRange = { mode: RangeMode; within: number };
export type ReleaseSettings = { volumes: ReleaseRange; chapters: ReleaseRange };

const MAX_WITHIN = { volumes: 10, chapters: 50 } as const;

// What New lists for a reader who hasn't chosen. Volumes: the next one
// they need, however far behind; the tab sorts a long list into piles by
// how far behind they are (client Home/piles.ts). Chapters: only once
// they're within a few of the latest, since a chapter backlog is long and
// nobody buys one. (Volumes were "within 3" for a day in November 2026; it
// left the "Way behind" pile (now "Long reads ahead") empty for everyone who hadn't chosen.)
const DEFAULT_RELEASE_SETTINGS: ReleaseSettings = {
  // (within 1: where the slider starts if they switch to "only series I'm
  // nearly caught up on", which is new releases only)
  volumes: { mode: "next", within: 1 },
  chapters: { mode: "within", within: 3 },
};

const toRange = (
  value: unknown,
  kind: keyof ReleaseSettings,
): ReleaseRange | null => {
  const { mode, within } = (value ?? {}) as Partial<ReleaseRange>;
  // "all" (everything that's out as one entry) was a third choice until
  // November 2026. A card that's behind opens the list of what's out on
  // every setting now, so anyone who saved it sees the same series as "next"
  const asked = (mode as string) === "all" ? "next" : mode;
  if (asked !== "next" && asked !== "within") return null;
  if (!Number.isInteger(within)) return null;
  if (within! < 1 || within! > MAX_WITHIN[kind]) return null;
  return { mode: asked, within: within! };
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
  // the volume that chapter is in, when the chapter list says: what a reader
  // who owns no volumes would buy to keep reading (chapter 39 of Chainsaw
  // Man is in vol. 5). Null when we can't tell
  nextChapterVolume: number | null;
  // the chapters in the next volume, for someone reading by the chapter with
  // no books: from where it starts to just before the next one ("to" null
  // when the next one's start isn't known: the newest volume)
  nextVolumeChapters: { from: number; to: number | null } | null;
  // the next English volume after where they are, and its price page
  nextVolume: number | null;
  nextVolumeBook: { isbn13: string; title: string } | null;
  // the book of two or three that volume is sold in, when it isn't sold on
  // its own: the card says "Book 8 next", what they can actually buy
  nextVolumeInBook: InBook | null;
  // every English volume past where they are: how far behind they are, and
  // the list a card opens
  outVolumes: { volume: number; isbn13?: string; title?: string }[];
  // English volumes out below their furthest that they don't own: counted
  // in "N to get" and listed first on the list a card opens
  gapVolumes: { volume: number; isbn13?: string; title?: string }[];
  // the same for what's only out in Japan
  outJapanVolumes: number[];
  latestChapter: number | null;
  latestJapaneseVolume: number | null;
  // for the Chapters list, when the chapter list is sure of it: the volume
  // their chapter is in ("Read up to ch. 1,128 · vol. 112")
  readingVolume: number | null;
  // the English books holding their next chapter and the ones after it,
  // each with its chapters: what a chapter card's list offers to buy
  chapterBooks: {
    volume: number;
    // "Book 8" for one sold in a book of two or three
    label: string;
    isbn13?: string;
    title?: string;
    chapters: { from: number; to: number | null } | null;
  }[];
  // the chapters out that no English volume holds yet: from just past the
  // newest English volume's last chapter to the newest out, with that
  // volume and where it ends ("Vol. 28 ends at ch. 210"). Null when there
  // are none, or we can't tell
  chaptersPastEnglish: {
    volume: number;
    endsAt: number;
    from: number;
    to: number;
  } | null;
};

type Shelved = {
  volumesOwned: number | null;
  bookmark: number | null;
  // the last volume read: stands in for a blank shelf
  readVolume?: number | null;
  // the newest they've said "Seen it" to; only something newer counts as new
  seenVolume?: number | null;
  seenChapter?: number | null;
  seenJapanVolume?: number | null;
  // hidden one at a time
  hiddenVolumes?: number[];
  // the exact volumes they own, when not a run from 1 (a gap at 12)
  ownedList?: number[];
};

// how a reader keeps their place: each series its own way, every series by
// chapters or by volumes, or both side by side (prefs.trackBy)
export type TrackBy = "series" | "chapters" | "volumes" | "both";
export const readTrackBy = (value: unknown): TrackBy =>
  value === "chapters" || value === "volumes" || value === "both"
    ? value
    : "series";
// which counters a series shows. One setting for every series wins; left on
// "series", each series follows its own switch. The same rule as the pages'
// (client/src/lib/reading.ts tracksOf): change both together
export const tracksOf = (byVolume: boolean | undefined, mode: TrackBy) => {
  if (mode === "both") return { chapters: true, volumes: true };
  if (mode === "chapters") return { chapters: true, volumes: false };
  if (mode === "volumes") return { chapters: false, volumes: true };
  return { chapters: !byVolume, volumes: Boolean(byVolume) };
};
// the series as its release check sees it: a number they don't track says
// nothing, so a volume reader gets no chapter news
export const placeFor = <
  M extends {
    bookmark: number | null;
    byVolume?: boolean;
    readVolume?: number | null;
  },
>(
  manga: M,
  trackBy: unknown,
): M => {
  const tracks = tracksOf(manga.byVolume, readTrackBy(trackBy));
  return {
    ...manga,
    bookmark: tracks.chapters ? manga.bookmark : null,
    readVolume: tracks.volumes ? (manga.readVolume ?? null) : null,
  };
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
        // sold only inside a book of two or three (Vinland Saga's Book 8
        // holds vols. 15 and 16)
        inBook?: InBook;
      }[]
    | null;
};

// "New" is what's next for this reader, as their settings ask: by default
// the next volume and the next chapter once they've nearly caught up. A
// blank shelf number can't say they've caught up, so it doesn't count (a
// blank volume falls back on the chapter they're on)
export function getReleaseStatus(
  {
    volumesOwned,
    bookmark,
    readVolume,
    seenVolume,
    seenChapter,
    seenJapanVolume,
    hiddenVolumes,
    ownedList,
  }: Shelved,
  { dates, englishVolumes }: Sources,
  { volumes, chapters }: ReleaseSettings = DEFAULT_RELEASE_SETTINGS,
): ReleaseStatus {
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
  const starts = dates?.volumeStarts ?? [];
  // someone reading by the chapter with no books and no volume read: the
  // volume their next chapter is in is the one they need, so they count as
  // having finished the one before it (on chapter 38, in vol. 5: vol. 4 done,
  // vol. 5 next). Without that, the volume their chapter is in
  const byChapterOnly = !volumesOwned && !readVolume && Boolean(bookmark);
  const holdsNextChapter = byChapterOnly
    ? volumeOfChapter(Math.floor(bookmark!) + 1, starts)
    : null;
  const currentVolume =
    volumesOwned ||
    readVolume ||
    (holdsNextChapter != null
      ? holdsNextChapter - 1
      : volumeOfChapter(bookmark, starts));
  const nextVolume =
    currentVolume != null
      ? (numbers.filter((v) => v > currentVolume).sort((a, b) => a - b)[0] ??
        null)
      : null;
  const nextBook = (englishVolumes ?? []).find((v) => v.volume === nextVolume);
  // the volumes below the furthest they own that they don't have (Chainsaw
  // Man owning 1–11 and 13–17 of 22: vol. 12), so "N to get" counts every
  // one, as the Volumes tab does. Each number, with its book when the
  // catalog lists one: it lists only some of Detective Conan's 60–69, and
  // owning 1–59 and 70–92 is still 10 short there
  const owns = new Set(ownedList ?? []);
  const bookOf = new Map(
    (englishVolumes ?? [])
      .filter((v) => v.volume != null && Number.isInteger(v.volume))
      .map((v) => [v.volume!, v]),
  );
  const gapVolumes: ReleaseStatus["gapVolumes"] = [];
  if (ownedList?.length && currentVolume != null) {
    for (let n = 1; n < currentVolume; n++) {
      if (owns.has(n)) continue;
      const book = bookOf.get(n);
      gapVolumes.push(
        book
          ? { volume: n, isbn13: book.isbn13, title: book.title }
          : { volume: n },
      );
    }
  }
  // for that reader, the chapters in it, so a card can say why that one:
  // "Vol. 5 · ch. 34–42" beside "Read up to ch. 38"
  const nextVolumeInBook = nextBook?.inBook ?? null;
  const nextVolumeChapters =
    byChapterOnly && nextVolume != null
      ? chaptersAcross(
          nextVolumeInBook?.from ?? nextVolume,
          nextVolumeInBook?.to ?? nextVolume,
          starts,
        )
      : null;
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
  const hasNewVolume = volumeListed && !isHidden(nextVolume);

  // a finished series too: nothing more is coming, but a reader behind
  // still has their next chapter to read (Chainsaw Man ended at 232; on 38,
  // ch. 39 is next), as the Volumes side lists its next volume. Caught up,
  // there's no next chapter, so nothing shows
  const chapterListed =
    nextChapter != null &&
    latestChapter != null &&
    (chapters.mode !== "within" ||
      latestChapter - (bookmark ?? 0) <= chapters.within);
  const hasNewChapter = chapterListed && nextChapter! > (seenChapter ?? 0);

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
    // it's next in line once they've reached the end of what's in English,
    // whatever their setting. (A reader on "nearly caught up" used to get
    // it early, so a stricter setting listed more series under In Japan)
    caughtUpWithEnglish;

  // the Chapters list's own: which English books hold their next chapter
  // and on, and what's out past the newest English volume. Only what the
  // chapter list is sure of
  const englishEnd =
    latestVolume != null
      ? (chaptersIn(latestVolume, starts)?.to ?? null)
      : null;
  const chaptersPastEnglish =
    nextChapter != null &&
    latestChapter != null &&
    englishEnd != null &&
    latestChapter > englishEnd
      ? {
          volume: latestVolume!,
          endsAt: englishEnd,
          from: englishEnd + 1,
          to: latestChapter,
        }
      : null;
  const firstHolding =
    nextChapter != null ? volumeSurelyHolding(nextChapter, starts) : null;
  const chapterBooks: ReleaseStatus["chapterBooks"] = [];
  if (firstHolding != null && latestVolume != null) {
    const seen = new Set<string>();
    for (let n = firstHolding; n <= latestVolume; n++) {
      // sold on its own, else the book of two or three holding it
      const book =
        (englishVolumes ?? []).find((v) => v.volume === n && !v.inBook) ??
        (englishVolumes ?? []).find(
          (v) => v.inBook && v.inBook.from <= n && n <= v.inBook.to,
        );
      const key = book?.isbn13 ?? `vol-${n}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const inBook = book?.inBook;
      chapterBooks.push({
        volume: n,
        label: inBook ? `Book ${inBook.book}` : `Vol. ${n}`,
        ...(book?.isbn13 ? { isbn13: book.isbn13 } : {}),
        ...(book?.title ? { title: book.title } : {}),
        chapters: inBook
          ? chaptersAcross(inBook.from, inBook.to, starts)
          : chaptersIn(n, starts),
      });
    }
  }

  return {
    hasNewVolume,
    hasNewChapter,
    hasNewJapaneseVolume:
      japanListed && latestJapaneseVolume! > (seenJapanVolume ?? 0),
    volumeListed,
    chapterListed,
    japanListed,
    outVolumes,
    gapVolumes,
    outJapanVolumes,
    isNextVolumeOut,
    currentVolume,
    nextChapterVolume: bookmark
      ? volumeOfChapter(Math.floor(bookmark) + 1, starts)
      : null,
    nextVolumeChapters,
    latestVolume,
    nextChapter,
    nextVolume,
    nextVolumeBook,
    nextVolumeInBook,
    latestChapter,
    latestJapaneseVolume,
    readingVolume: volumeSurelyHolding(bookmark, starts),
    chapterBooks,
    chaptersPastEnglish,
  };
}
