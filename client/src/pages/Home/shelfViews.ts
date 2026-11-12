// The shelf's views and what's on them, with no React: the tabs as the address
// names them, what each side of the New tab is called, which series a view
// shows and in what order, the counts on the tabs, and what a New card says.
// Pure, so server/src/tests/shelf/shelfViews.test.ts can test it.
import { ownedPhrase, ownsAny } from "../../lib/ownedVolumes";
import {
  countNew,
  remainingChapters,
  remainingJapanVolumes,
  remainingVolumes,
  type SeenKind,
} from "../../lib/releaseMath";
import type { Manga, ReleaseStatus } from "../../lib/types";

export type Releases = Record<number, ReleaseStatus | null>;
// what a New card says (MangaCard's CardNews, written here so this file needs
// no components: the server's tests load it)
export type CardNews = { text: string; yours?: string };

export const SHELF_PAGE_SIZE = 20;
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
    emptyBody: "Nothing new to show for now. Your shelf gets a day off.",
  },
  chapters: {
    label: "Chapters",
    // MangaUpdates counts every language and doesn't say which is which
    note: "",
    emptyTitle: "Nothing new to read. Go touch grass!",
    waiting: "No new chapters yet",
    emptyBody: "Nothing new to show for now. Check back soon.",
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
export const seenOf = (m: Manga, kind: SeenKind) =>
  (kind === "volume"
    ? m.seenVolume
    : kind === "chapter"
      ? m.seenChapter
      : m.seenJapanVolume) ?? null;

// this series, in this view, lists everything that's out as one entry
export const isGrouped = (
  found: ReleaseStatus | null | undefined,
  kind: ReleaseKind,
) => (kind === "chapters" ? found?.chapterMode : found?.volumeMode) === "all";

// what "Hide" on its card hides up to: everything that's out when the card
// lists it all, otherwise the one it shows
export const newestOf = (
  found: ReleaseStatus | null | undefined,
  kind: ReleaseKind,
) => {
  const grouped = isGrouped(found, kind);
  return kind === "volumes"
    ? grouped
      ? found?.latestVolume
      : found?.nextVolume
    : kind === "chapters"
      ? grouped
        ? found?.latestChapter
        : found?.nextChapter
      : found?.latestJapaneseVolume;
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
    // series they own any volumes of
    volumes: list.filter((m) => ownsAny(m)).length,
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
    list = list.filter(
      (m) =>
        m.name?.toLowerCase().includes(q) || m.genre?.toLowerCase().includes(q),
    );
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
    case "name-asc":
      list.sort((a, b) => a.name.localeCompare(b.name));
      break;
  }
  return list;
}

// what a card on the New tab says: what's out, and where they are, so the two
// numbers can't be mixed up
export function newsFor(
  m: Manga,
  found: ReleaseStatus | null | undefined,
  kind: ReleaseKind,
  viewingHidden: boolean,
): CardNews {
  const volumeYours = ownedPhrase(m)
    ? `You own ${ownedPhrase(m)}`
    : found?.currentVolume
      ? `You're on vol. ${found.currentVolume}`
      : undefined;
  if (found && isGrouped(found, kind)) {
    // what's hidden is everything, when looking at what's hidden
    const out = (left: number[], all: number[]) =>
      viewingHidden || !left.length ? all : left;
    const range = (prefix: string, numbers: number[]) =>
      numbers.length > 1
        ? `${prefix} ${numbers[0]}–${numbers.at(-1)}`
        : `${prefix} ${numbers[0]}`;
    if (kind === "japan") {
      const shown = out(remainingJapanVolumes(m, found), found.outJapanVolumes);
      return { text: `${range("Vol.", shown)} in Japan`, yours: volumeYours };
    }
    if (kind === "chapters") {
      const left = remainingChapters(m, found);
      return {
        text:
          viewingHidden || !left.length
            ? `Ch. ${found.nextChapter}–${found.latestChapter} available`
            : `${range("Ch.", [left[0]!, left.at(-1)!])} available`,
        yours: m.bookmark ? `You're on ch. ${m.bookmark}` : undefined,
      };
    }
    const shown = out(
      remainingVolumes(m, found).map((v) => v.volume),
      found.outVolumes.map((v) => v.volume),
    );
    return { text: `${range("Vol.", shown)} available`, yours: volumeYours };
  }
  if (kind === "japan") {
    return {
      text: `Vol. ${found?.latestJapaneseVolume} in Japan`,
      yours: volumeYours,
    };
  }
  if (kind === "chapters") {
    const nextChapter = found?.nextChapter;
    return {
      // theirs next; "is out" is news, so only for the newest
      text:
        nextChapter === found?.latestChapter
          ? `Ch. ${nextChapter} is out`
          : `Ch. ${nextChapter} next`,
      yours: m.bookmark ? `You're on ch. ${m.bookmark}` : undefined,
    };
  }
  // "is out" is news, so it's only for the newest
  const next = found?.nextVolume;
  return {
    text:
      next === found?.latestVolume
        ? `Vol. ${next} is out`
        : `Vol. ${next} next`,
    // "Vol. 6 next" already says they're on 5: said twice, it's clutter
    yours:
      next != null &&
      found?.currentVolume != null &&
      next === found.currentVolume + 1
        ? undefined
        : volumeYours,
  };
}
