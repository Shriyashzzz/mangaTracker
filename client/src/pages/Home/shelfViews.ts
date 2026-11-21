// The shelf's views and what's on them, with no React: the tabs as the address
// names them, what each side of the New tab is called, which series a view
// shows and in what order, the counts on the tabs, and what a New card says.
// Pure, so server/src/tests/shelf/shelfViews.test.ts can test it.
import { editionNews } from "../../lib/editionNews";
import {
  ownedCount,
  ownedOf,
  ownedPhrase,
  ownsAny,
} from "../../lib/ownedVolumes";
import { chaptersText, readsByChapterOnly } from "../../lib/chapterWords";
import { closeEnough } from "../../lib/nearMatches";
import {
  countNew,
  knowsNextVolume,
  nextVolumeName,
  nextVolumeNumber,
  type SeenKind,
} from "../../lib/releaseMath";
import type { Manga, ReleaseStatus } from "../../lib/types";
// (piles.ts takes only types from this file, so the two don't go in a circle)
import { behindOf, volumesBehind } from "./piles";

export type Releases = Record<number, ReleaseStatus | null>;
// what a New card says (MangaCard's CardNews, written here so this file needs
// no components: the server's tests load it)
export type CardNews = {
  // what's next ("Vol. 13 next"); empty when we can't say which is next
  text: string;
  // the same, cut short for a phone's row ("Def. 3 next"), when it's long
  short?: string;
  yours?: string;
  // "2 volumes behind", when they are: the card says it under the text,
  // and goes grey
  behind?: string;
};

// series a page of the shelf shows: 20, or 60 on a shelf of over 200, so a
// big collection isn't twenty pages. Sized by the whole shelf, so it's the
// same on every tab
export const shelfPageSize = (shelfCount: number) =>
  shelfCount > 200 ? 60 : 20;
// shelves this size get a heads-up that their first release check is slow
export const BIG_SHELF = 10;
// after this many checks with nothing new, the big "Checking" box gives way
// to one line, so a long shelf doesn't look stuck
export const EARLY_CHECKS = 6;
// how long the "Hidden" and "Moved" notes and their undo stay up
export const NOTE_MS = 8000;

// the shelf's views as the address names them (/shelf?tab=to-read)
export const URL_FROM_TAB: Record<string, string> = {
  all: "all",
  ongoing: "reading",
  finished: "finished",
  planned: "to-read",
  volumes: "volumes",
  new: "new",
};
export const TAB_FROM_URL: Record<string, string> = Object.fromEntries(
  Object.entries(URL_FROM_TAB).map(([tab, word]) => [word, tab]),
);
// Select's Move to, as the tabs name them
export const MOVE_LABELS = {
  finished: "Finished",
  planned: "To read",
  reading: "Reading",
} as const;

// what each side of the New tab's switch shows, and how it says there's nothing
export const RELEASE_KINDS = {
  volumes: {
    label: "Volumes",
    // nothing beside the switch: what English means here is plain enough
    note: "",
    emptyTitle: "No new volumes. Your wallet lives!",
    waiting: "No new volumes yet",
    emptyBody: "Your shelf gets a day off.",
  },
  chapters: {
    label: "Chapters",
    // MangaUpdates counts every language and doesn't say which is which
    note: "",
    emptyTitle: "Nothing new to read. Go touch grass!",
    waiting: "No new chapters yet",
    emptyBody: "Check back soon.",
  },
  japan: {
    label: "In Japan",
    note: "Out in Japan, maybe not in English yet.",
    emptyTitle: "Japan has nothing on you. Yet!",
    waiting: "Nothing new in Japan yet",
    emptyBody: "No volumes in Japan to show for now.",
  },
} as const;
export type ReleaseKind = keyof typeof RELEASE_KINDS;

// which flags say a release is on the New tab, and still new
const RELEASE_FLAGS = {
  volumes: { listed: "volumeListed", isNew: "hasNewVolume" },
  chapters: { listed: "chapterListed", isNew: "hasNewChapter" },
  japan: { listed: "japanListed", isNew: "hasNewJapaneseVolume" },
} as const;
// what "Hide" saves, for each side of the switch
export const SEEN_KIND = {
  volumes: "volume",
  chapters: "chapter",
  japan: "japan",
} as const;

// they've hidden this one, and nothing newer has come along
export const isHiddenAs = (
  found: ReleaseStatus | null | undefined,
  kind: ReleaseKind,
) =>
  Boolean(
    found?.[RELEASE_FLAGS[kind].listed] && !found[RELEASE_FLAGS[kind].isNew],
  );

// sessionStorage can throw in locked-down browsers, the filters just won't persist then
export const readSession = (key: string, fallback: string) => {
  try {
    return sessionStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
};
export const writeSession = (key: string, value: string) => {
  try {
    sessionStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
};

// where they were on the shelf when they opened a manga, so coming back puts them
// there again. Per tab, so an old spot can't turn up days later
export const SHELF_SPOT_KEY = "shelfSpot";
type ShelfSpot = {
  y: number;
  key: string;
  index: number;
  query: string;
};
export const readSpot = (): ShelfSpot | null => {
  try {
    return JSON.parse(readSession(SHELF_SPOT_KEY, "null")) as ShelfSpot | null;
  } catch {
    return null;
  }
};

// what they last hid of this kind
export function seenOf(m: Manga, kind: SeenKind) {
  if (kind === "volume") return m.seenVolume ?? null;
  if (kind === "chapter") return m.seenChapter ?? null;
  return m.seenJapanVolume ?? null;
}

// Does its card open the list of what's out (the popup)? A volumes card
// with more than one out past theirs, so "A few behind" and "Long reads ahead":
// each row leads to that book's prices. One volume out goes straight to
// its prices. A chapters card opens the books holding their next chapter,
// or says it's in none yet. Never Japan: a list of numbers leads nowhere
export const opensAList = (
  found: ReleaseStatus | null | undefined,
  kind: ReleaseKind,
) =>
  kind === "chapters"
    ? // the books holding their next chapter, or word of where it is
      found?.nextChapter != null
    : // more than one out past theirs: the list of them. For an edition,
      // its books ("Definitive 3, 4, 5"), never the single volumes
      kind === "volumes" &&
      (found?.editionBooks
        ? (found.editionBooks.toGet?.length ?? 0) > 1
        : behindOf(found, kind) > 1);

// what "Hide" on its card hides up to: the one it shows
export const newestOf = (
  found: ReleaseStatus | null | undefined,
  kind: ReleaseKind,
) => {
  if (kind === "volumes") return found?.nextVolume;
  if (kind === "chapters") return found?.nextChapter;
  return found?.latestJapaneseVolume;
};

// the counts on the tabs and on the New tab's switch
export function shelfCounts(list: Manga[], releases: Releases) {
  const finished = list.filter((m) => m.status).length;
  const planned = list.filter((m) => m.planned).length;
  // nothing's new for one they haven't started
  const started = list.filter((m) => !m.planned);
  return {
    all: list.length,
    ongoing: list.length - finished - planned,
    finished,
    planned,
    // every volume they own, as the Volumes tab's own heading counts them
    // ("230 volumes across 82 series"), not the series
    volumes: list.reduce((sum, m) => sum + ownedCount(m), 0),
    newVolumes: started.filter((m) => releases[m.id]?.hasNewVolume).length,
    newChapters: started.filter((m) => releases[m.id]?.hasNewChapter).length,
    newInJapan: started.filter((m) => releases[m.id]?.hasNewJapaneseVolume)
      .length,
    new: countNew(list, releases),
  };
}

type ShelfFilter = {
  // the tab: all, ongoing, finished, planned, volumes or new
  tab: string;
  releaseKind: ReleaseKind;
  // on New: the list of what they've hidden, not what's new
  viewingHidden: boolean;
  query: string;
  sortBy: string;
};

// the series a view shows, in its order
export function filterShelf(
  manga: Manga[],
  releases: Releases,
  { tab, releaseKind, viewingHidden, query, sortBy }: ShelfFilter,
) {
  let list = [...manga];
  if (tab === "finished") list = list.filter((m) => m.status);
  if (tab === "ongoing") list = list.filter((m) => !m.status && !m.planned);
  if (tab === "planned") list = list.filter((m) => m.planned);
  if (tab === "volumes") list = list.filter((m) => ownsAny(m));
  // nothing's new for one they haven't started (as shelfCounts counts it)
  if (tab === "new") {
    list = list.filter(
      (m) =>
        !m.planned &&
        (viewingHidden
          ? isHiddenAs(releases[m.id], releaseKind)
          : releases[m.id]?.[RELEASE_FLAGS[releaseKind].isNew]),
    );
  }

  const q = query.trim().toLowerCase();
  if (q) {
    const found = list.filter(
      (m) =>
        m.name?.toLowerCase().includes(q) ||
        m.genre?.toLowerCase().includes(q) ||
        // "novel" or "light novel" finds the light novels
        (m.lightNovel && "light novel".includes(q)),
    );
    // nothing, and long enough to be a word: a slip of the finger
    // ("chainsw" finds Chainsaw Man), as every series search allows
    // (lib/nearMatches.ts). Never for a few letters, which are near anything
    list =
      found.length || q.length < 4
        ? found
        : list.filter((m) => m.name && closeEnough(q, m.name));
  }

  switch (sortBy) {
    case "rating-dsc":
      list.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
      break;
    case "ch-dsc":
      list.sort((a, b) => (b.bookmark ?? 0) - (a.bookmark ?? 0));
      break;
    case "vol-dsc": {
      // the exact list's size when it has gaps, else 1 to "up to"
      const count = (m: Manga) =>
        m.ownedList?.length ? m.ownedList.length : (m.volumesOwned ?? 0);
      list.sort((a, b) => count(b) - count(a));
      break;
    }
    case "gaps-dsc": {
      // every volume out that isn't theirs: the holes below the furthest
      // they own, and the ones out after it (Blue Lock, owned to vol. 5 with
      // 22 out, is 17 short, not 0)
      const gaps = (m: Manga) => {
        const whole = ownedOf(m).filter((v) => Number.isInteger(v) && v >= 1);
        const furthest = whole.length ? Math.max(...whole) : 0;
        const holes = furthest - whole.length;
        const latest = releases[m.id]?.latestVolume ?? 0;
        return holes + Math.max(0, latest - furthest);
      };
      list.sort((a, b) => gaps(b) - gaps(a));
      break;
    }
    case "added-dsc":
      // ids count up as series are added
      list.sort((a, b) => b.id - a.id);
      break;
    case "name-asc":
      list.sort((a, b) => a.name.localeCompare(b.name));
      break;
  }
  return list;
}

// What a card on the New tab says, and where they are, apart, so the two
// numbers can't be mixed up. What it says is always the same: what's next for them ("Vol. 13
// next"), whether it came out last week or years ago. When they're behind
// (piles.ts volumesBehind), the card is given the words for it: "2 volumes
// behind". (It used to say "Vol. 15 is out" for the newest volume, which
// read as news about a book that might be old.)
function behindWords(
  found: ReleaseStatus | null | undefined,
  kind: ReleaseKind,
) {
  const behind = volumesBehind(found, kind);
  if (!behind) return undefined;
  const unit = kind === "chapters" ? "chapter" : "volume";
  return `${behind} ${unit}${behind === 1 ? "" : "s"} behind`;
}

export function newsFor(
  m: Manga,
  found: ReleaseStatus | null | undefined,
  kind: ReleaseKind,
): CardNews {
  // where they are by the volume: what they own, else what they've read
  const owns = ownedPhrase(m);
  // reading by the chapter with no books: their place is a chapter
  const byChapter = readsByChapterOnly(m);
  let volumeYours: string | undefined;
  if (owns) volumeYours = `You own ${owns}`;
  else if (byChapter) volumeYours = `Read up to ch. ${m.bookmark}`;
  else if (found?.currentVolume)
    volumeYours = `Read up to vol. ${found.currentVolume}`;
  if (kind === "japan") {
    return {
      text: `Vol. ${found?.latestJapaneseVolume} in Japan`,
      yours: volumeYours,
    };
  }
  if (kind === "chapters") {
    const nextChapter = found?.nextChapter;
    return {
      text: `Ch. ${nextChapter} next`,
      behind: behindWords(found, kind),
      // and the volume that chapter is in, when the chapter list is sure
      yours: m.bookmark
        ? `Read up to ch. ${m.bookmark}${found?.readingVolume ? ` · vol. ${found.readingVolume}` : ""}`
        : undefined,
    };
  }
  // collected as an edition: what's next is one of its books, "VIZBIG 5
  // next" (lib/editionNews.ts)
  const inBooks = editionNews(m);
  if (inBooks)
    return {
      text: inBooks.text,
      behind: inBooks.behind,
      yours: inBooks.yours ?? volumeYours,
    };
  // nothing past theirs known to be out: only how far behind they are
  const next = nextVolumeNumber(found);
  if (found && next == null)
    return { text: "", behind: behindWords(found, kind), yours: volumeYours };
  // the catalog's own next book (not the one after a hole in it)
  const catalogsNext = knowsNextVolume(found);
  // "vol. 15", or the book it's sold in: "Book 8"
  const nextName =
    catalogsNext && found?.nextVolumeInBook
      ? nextVolumeName(found)
      : `vol. ${next}`;
  // a chapter reader is told which chapters that book holds, under their
  // own: "Read up to ch. 38 · vol. 5 has ch. 35–43". Only for the catalog's
  // own next book, which the chapters were worked out for
  const range =
    byChapter && catalogsNext && next != null
      ? found?.nextVolumeChapters
      : null;
  if (range && volumeYours)
    volumeYours = `${volumeYours} · ${nextName} has ${chaptersText(range)}`;
  return {
    text: `${nextVolumeName(found)} next`,
    behind: behindWords(found, kind),
    // always, so every card answers "where am I?" the same way
    yours: volumeYours,
  };
}
