import { useState, useEffect, useMemo, useRef } from "react";
import ShelfBar from "./ShelfBar";
import { ownedPhrase, ownsAny } from "../../lib/ownedVolumes";
import VolumesView from "./VolumesView";
import { createPortal } from "react-dom";
import MangaCard, {
  MangaCardSkeleton,
  type CardNews,
} from "../../components/mangaCard/MangaCard";

import { homeStyles as styles } from "./styles";
import { NavLink, useNavigate, useSearchParams } from "react-router";
import {
  CheckIcon,
  ChevronDownIcon,
  CloseIcon,
  PlusIcon,
  StarIcon,
} from "../../components/icons/Icons";
import RangePager from "../../components/rangePager/RangePager";
import Mascot from "../../components/mascot/Mascot";
import SlowLoadQuote from "../../components/slowLoadQuote/SlowLoadQuote";
import { usePrivatePage } from "../../lib/seo";
import { volumePath } from "../../lib/prices";
import type { Manga, ReleaseStatus } from "../../lib/types";
import { useAuth } from "../../store/auth";
import { useShelf, type ShelfMove, type ShelfPlace } from "../../store/shelf";
import {
  readLocal,
  savePrefs,
  useReleaseChecksOn,
  writeLocal,
} from "../../lib/prefs";
import {
  CHECKED_BEFORE_KEY,
  isStillNew,
  LAST_NEW_COUNT_KEY,
  remainingChapters,
  remainingJapanVolumes,
  remainingVolumes,
  SORT_OPTIONS,
  type SeenKind,
} from "../../lib/shelf";
import ReleaseModal from "./ReleaseModal";
import DeleteManyModal from "./DeleteManyModal";
import { EmptyShelfUndo } from "../../components/deletedNote/DeletedNote";
import ReleaseTip from "../../components/whatsNew/ReleaseTip";
import ViewPeek from "../../components/viewPeek/ViewPeek";
import TakeTourButton from "../../components/tour/TakeTourButton";

const SHELF_PAGE_SIZE = 20;
// shelves this size get a heads-up that their first release check is slow
const BIG_SHELF = 10;
// after this many checks with nothing new, the big "Checking" box gives way
// to one line, so a long shelf doesn't look stuck
const EARLY_CHECKS = 6;
// how long the "Hide" note and its undo stay up
const SEEN_NOTE_MS = 8000;
// the shelf's views as the address names them (/shelf?tab=to-read)
const URL_FROM_TAB: Record<string, string> = {
  all: "all",
  ongoing: "reading",
  finished: "finished",
  planned: "to-read",
  volumes: "volumes",
  new: "new",
};
const TAB_FROM_URL: Record<string, string> = Object.fromEntries(
  Object.entries(URL_FROM_TAB).map(([tab, word]) => [word, tab]),
);
// Select's Move to, as the tabs name them
const MOVE_LABELS = {
  finished: "Finished",
  planned: "To read",
  reading: "Reading",
} as const;

// what each side of the New tab's switch shows, and how it says there's nothing
const RELEASE_KINDS = {
  volumes: {
    label: "Volumes",
    note: "English releases only. Japan may be ahead.",
    emptyTitle: "No new volumes. Your wallet lives!",
    waiting: "No new volumes yet",
    emptyBody: "Nothing new to show for now. Your shelf gets a day off.",
  },
  chapters: {
    label: "Chapters",
    // MangaUpdates counts every language and doesn't say which is which
    note: "Mostly English. A chapter may still be on its way in English.",
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
type ReleaseKind = keyof typeof RELEASE_KINDS;

// which flags say a release is on the New tab, and still new
const RELEASE_FLAGS = {
  volumes: { listed: "volumeListed", isNew: "hasNewVolume" },
  chapters: { listed: "chapterListed", isNew: "hasNewChapter" },
  japan: { listed: "japanListed", isNew: "hasNewJapaneseVolume" },
} as const;
// they've hidden this one, and nothing newer has come along
const isHiddenAs = (
  found: ReleaseStatus | null | undefined,
  kind: ReleaseKind,
) =>
  Boolean(
    found?.[RELEASE_FLAGS[kind].listed] && !found[RELEASE_FLAGS[kind].isNew],
  );

// sessionStorage can throw in locked-down browsers, the filters just won't persist then
const readSession = (key: string, fallback: string) => {
  try {
    return sessionStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
};
const writeSession = (key: string, value: string) => {
  try {
    sessionStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
};

export default function Home() {
  usePrivatePage("Your shelf");
  const isSignedIn = useAuth((s) => s.isSignedIn);

  if (isSignedIn === null) {
    return <LibrarySkeleton />;
  }
  return isSignedIn ? <Library /> : <GuestHero />;
}

// where they were on the shelf when they opened a manga, so coming back puts them
// there again. Per tab, so an old spot can't turn up days later
const SHELF_SPOT_KEY = "shelfSpot";
type ShelfSpot = { y: number; key: string; index: number; query: string };
const readSpot = (): ShelfSpot | null => {
  try {
    return JSON.parse(readSession(SHELF_SPOT_KEY, "null")) as ShelfSpot | null;
  } catch {
    return null;
  }
};
const SEEN_KIND = {
  volumes: "volume",
  chapters: "chapter",
  japan: "japan",
} as const;

function Library() {
  const mangaData = useShelf((s) => s.manga);
  const loadError = useShelf((s) => s.loadFailed);
  const releases = useShelf((s) => s.releases);
  const outcomes = useShelf((s) => s.outcomes);
  const loadShelf = useShelf((s) => s.load);
  const checkReleases = useShelf((s) => s.checkReleases);
  const recheckReleases = useShelf((s) => s.recheckReleases);
  const [spot] = useState(readSpot);
  const [query, setQuery] = useState(spot?.query ?? "");
  // in the address, so it's a step of its own: the back gesture leaves the list
  // and returns to New, and coming back from a volume lands on it again
  const [searchParams, setSearchParams] = useSearchParams();
  const wantHidden = searchParams.get("view") === "hidden";
  const checksOn = useReleaseChecksOn();
  const [statusFilter, setStatusFilter] = useState(() => {
    if (wantHidden && checksOn) return "new";
    // a link to a view (/shelf?tab=reading) wins over where they were last
    const linked = TAB_FROM_URL[searchParams.get("tab") ?? ""];
    const saved =
      linked ?? readSession("libraryStatus", readLocal("shelfTab") ?? "all");
    // no New tab with release checks off
    return saved === "new" && !checksOn ? "all" : saved;
  });
  // switched off while on the New tab, or the account's choice just arrived
  if (!checksOn && statusFilter === "new") setStatusFilter("all");
  // a link to another view while already on the shelf switches to it
  const urlTab = searchParams.get("tab");
  const [seenUrlTab, setSeenUrlTab] = useState(urlTab);
  if (urlTab !== seenUrlTab) {
    setSeenUrlTab(urlTab);
    const linked = TAB_FROM_URL[urlTab ?? ""];
    if (linked && linked !== statusFilter) setStatusFilter(linked);
  }
  // the view is in the address too, so it can be bookmarked or shared
  // (replaced, not pushed: switching views doesn't fill the back button)
  useEffect(() => {
    const word = URL_FROM_TAB[statusFilter];
    if (!word || searchParams.get("tab") === word) return;
    const next = new URLSearchParams(searchParams);
    next.set("tab", word);
    setSearchParams(next, { replace: true });
  }, [statusFilter, searchParams, setSearchParams]);
  const [sortBy, setSortBy] = useState(() => {
    const saved = readSession("librarySort", readLocal("shelfSort") ?? "");
    return SORT_OPTIONS.some((o) => o.value === saved) ? saved : "";
  });
  const navigator = useNavigate();
  // the shelf shows one block of manga at a time; any change to the tab,
  // search or sort starts again from the first block
  const [releaseKind, setReleaseKind] = useState<ReleaseKind>(() => {
    const saved = readSession("libraryReleaseKind", "volumes");
    return saved in RELEASE_KINDS ? (saved as ReleaseKind) : "volumes";
  });
  // the New tab's list of what they've hidden
  // the series whose grouped list is open
  const [openRelease, setOpenRelease] = useState<number | null>(null);
  // on small screens, search and sort fold away on the New tab so the news comes first
  // set in settings
  // Kenji's compact-rows offer (ViewPeek) can change it while they're here
  const [rowsChosen, setRowsChosen] = useState(
    () => readLocal("shelfView") === "rows",
  );
  const hiddenCount = (mangaData ?? []).filter((m) =>
    isHiddenAs(releases[m.id], releaseKind),
  ).length;
  // showing the last one again leaves nothing here, so it goes back to what's new
  const viewingHidden = statusFilter === "new" && wantHidden && hiddenCount > 0;
  const filterKey = `${statusFilter}|${releaseKind}|${viewingHidden}|${sortBy}|${query.trim().toLowerCase()}`;
  const [page, setPage] = useState({
    key: spot?.key ?? filterKey,
    index: spot?.index ?? 0,
  });
  const pageIndex = page.key === filterKey ? page.index : 0;

  useEffect(() => {
    loadShelf();
  }, [loadShelf]);

  const saveSpot = () =>
    writeSession(
      SHELF_SPOT_KEY,
      JSON.stringify({
        y: window.scrollY,
        key: filterKey,
        index: pageIndex,
        query,
      }),
    );
  // back where they were, once there's a shelf to be somewhere on. A frame later,
  // so it lands after the router's own scroll to the top
  const shelfReady = Boolean(mangaData?.length);
  useEffect(() => {
    if (!spot || !shelfReady) return;
    try {
      sessionStorage.removeItem(SHELF_SPOT_KEY);
    } catch {
      /* ignore */
    }
    const frame = requestAnimationFrame(() => window.scrollTo(0, spot.y));
    return () => cancelAnimationFrame(frame);
  }, [spot, shelfReady]);

  // the last "Hide", for its undo; or a save that failed
  const markSeen = useShelf((s) => s.markSeen);
  const [hidden, setHidden] = useState<{
    id: number;
    name: string;
    kind: SeenKind;
    previous: number | null;
    previousList: number[];
    // true when they've just brought it back rather than hidden it
    restored?: boolean;
    // after "Unhide all": everything to put back for the undo
    others?: { id: number; previous: number | null; previousList: number[] }[];
  } | null>(null);
  const [seenFailed, setSeenFailed] = useState(false);
  const seenNote = useRef<HTMLDivElement>(null);
  // the note leaves on its own, but not from under someone reading or tabbing to it
  useEffect(() => {
    if (!hidden && !seenFailed) return;
    let timer: ReturnType<typeof setTimeout>;
    const wait = () => {
      timer = setTimeout(() => {
        const note = seenNote.current;
        if (note?.matches(":hover") || note?.querySelector(":focus-visible"))
          wait();
        else {
          setHidden(null);
          setSeenFailed(false);
        }
      }, SEEN_NOTE_MS);
    };
    wait();
    return () => clearTimeout(timer);
  }, [hidden, seenFailed]);
  // the card that was just hidden is gone, so its focus moves to the undo
  useEffect(() => {
    if (hidden)
      seenNote.current?.querySelector("button")?.focus({ preventScroll: true });
  }, [hidden]);

  const hasManga = Boolean(mangaData?.length);
  // what's new for each manga. Only asked for once the New tab is opened, or for
  // anyone on rows, whose progress needs the latest chapter. After that it carries
  // on even if they leave, and new titles get picked up
  const showingNew = statusFilter === "new";

  // Select: tick cards, then delete them together. Not on New or Volumes, where
  // a card does something else
  const [selecting, setSelecting] = useState(false);
  const [picked, setPicked] = useState<Set<number>>(() => new Set());
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  // Move to: its menu, and what was moved for the undo
  const [moveOpen, setMoveOpen] = useState(false);
  const [moving, setMoving] = useState(false);
  const [moved, setMoved] = useState<{
    to: ShelfMove;
    was: ShelfPlace[];
    name: string;
  } | null>(null);
  const [moveFailed, setMoveFailed] = useState(false);
  const moveMenu = useRef<HTMLDivElement>(null);
  const canSelect =
    !showingNew && statusFilter !== "volumes" && Boolean(mangaData?.length);
  const selectOn = selecting && canSelect;
  const stopSelecting = () => {
    setSelecting(false);
    setPicked(new Set());
  };
  const togglePicked = (id: number) =>
    setPicked((now) => {
      const next = new Set(now);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  useEffect(() => {
    if (!selectOn) return;
    const leave = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      // the confirm dialog's own Escape closes just the dialog, and the
      // search's clears the search
      if (document.querySelector("dialog[open]")) return;
      // the Move to menu closes first
      if (moveOpen) {
        setMoveOpen(false);
        moveMenu.current?.querySelector("button")?.focus();
        return;
      }
      // a ticked card's box still leaves; a text box keeps its Escape
      if (
        (e.target as Element | null)?.closest(
          "input:not([type=checkbox]), textarea, select",
        )
      )
        return;
      stopSelecting();
    };
    window.addEventListener("keydown", leave);
    return () => window.removeEventListener("keydown", leave);
  }, [selectOn, moveOpen]);
  // a tap anywhere else closes the menu
  useEffect(() => {
    if (!moveOpen) return;
    const away = (e: PointerEvent) => {
      if (!moveMenu.current?.contains(e.target as Node)) setMoveOpen(false);
    };
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, [moveOpen]);
  // "Moved 12 series to Finished · Undo" leaves on its own, but not from
  // under someone on it
  const movedNote = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!moved && !moveFailed) return;
    let timer: ReturnType<typeof setTimeout>;
    const wait = () => {
      timer = setTimeout(() => {
        const note = movedNote.current;
        if (note?.matches(":hover") || note?.querySelector(":focus-visible"))
          wait();
        else {
          setMoved(null);
          setMoveFailed(false);
        }
      }, SEEN_NOTE_MS);
    };
    wait();
    return () => clearTimeout(timer);
  }, [moved, moveFailed]);
  // the "Deleted · Undo" note sits where the bar does: the bar goes above it
  const undoShowing = useShelf((s) => Boolean(s.lastDeleted?.length));
  useEffect(() => {
    if (checksOn && (showingNew || rowsChosen) && mangaData?.length)
      checkReleases();
  }, [mangaData, releases, showingNew, rowsChosen, checksOn, checkReleases]);
  const checked = (mangaData ?? []).filter((m) => m.id in releases).length;
  const checking = showingNew && checked < (mangaData?.length ?? 0);
  const allChecked = checked > 0 && checked >= (mangaData?.length ?? 0);
  const [checkedBefore] = useState(
    () => readLocal(CHECKED_BEFORE_KEY) !== null,
  );
  const [lastNewCount] = useState(() => {
    const saved = readLocal(LAST_NEW_COUNT_KEY);
    return saved ? Number(saved) : null;
  });

  const counts = useMemo(() => {
    const list = mangaData ?? [];
    const finished = list.filter((m) => m.status).length;
    const planned = list.filter((m) => m.planned).length;
    // nothing's new for one they haven't started
    const started = list.filter((m) => !m.planned);
    const newVolumes = started.filter(
      (m) => releases[m.id]?.hasNewVolume,
    ).length;
    const newChapters = started.filter(
      (m) => releases[m.id]?.hasNewChapter,
    ).length;
    const newInJapan = started.filter(
      (m) => releases[m.id]?.hasNewJapaneseVolume,
    ).length;
    return {
      all: list.length,
      ongoing: list.length - finished - planned,
      finished,
      planned,
      // series they own any volumes of
      volumes: list.filter((m) => ownsAny(m)).length,
      newVolumes,
      newChapters,
      newInJapan,
      new: started.filter(
        (m) => releases[m.id]?.hasNewVolume || releases[m.id]?.hasNewChapter,
      ).length,
    };
  }, [mangaData, releases]);

  // nothing left hidden, so there's no list to be on. Opened straight onto it,
  // the check has to finish first to know what's hidden; once it's been shown,
  // emptying it leaves at once. Otherwise ?view=hidden stays, and the next card
  // hidden brings the list back holding just that one
  const sawHidden = useRef(false);
  useEffect(() => {
    if (viewingHidden) sawHidden.current = true;
  }, [viewingHidden]);
  useEffect(() => {
    if (!wantHidden) sawHidden.current = false;
    else if (hiddenCount === 0 && (allChecked || sawHidden.current)) {
      sawHidden.current = false;
      navigator("/shelf", { replace: true });
    }
  }, [wantHidden, allChecked, hiddenCount, navigator]);

  useEffect(() => {
    if (!allChecked) return;
    writeLocal(CHECKED_BEFORE_KEY, "yes");
    writeLocal(LAST_NEW_COUNT_KEY, String(counts.new));
  }, [allChecked, counts.new]);

  const visibleManga = useMemo(() => {
    let list = [...(mangaData ?? [])];
    if (statusFilter === "finished") list = list.filter((m) => m.status);
    if (statusFilter === "ongoing")
      list = list.filter((m) => !m.status && !m.planned);
    if (statusFilter === "planned") list = list.filter((m) => m.planned);
    if (statusFilter === "volumes") list = list.filter((m) => ownsAny(m));
    if (statusFilter === "new") {
      list = list.filter((m) =>
        !m.planned && viewingHidden
          ? isHiddenAs(releases[m.id], releaseKind)
          : releases[m.id]?.[RELEASE_FLAGS[releaseKind].isNew],
      );
    }

    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (m) =>
          m.name?.toLowerCase().includes(q) ||
          m.genre?.toLowerCase().includes(q),
      );
    }

    switch (sortBy) {
      case "rating-dsc":
        list.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
        break;
      case "ch-dsc":
        list.sort((a, b) => (b.bookmark ?? 0) - (a.bookmark ?? 0));
        break;
      case "name-asc":
        list.sort((a, b) => a.name.localeCompare(b.name));
        break;
    }
    return list;
  }, [
    mangaData,
    releases,
    releaseKind,
    viewingHidden,
    statusFilter,
    sortBy,
    query,
  ]);

  // only what this tab and search show counts as ticked: nothing hidden from
  // view gets deleted
  const pickedShown = selectOn
    ? visibleManga.filter((m) => picked.has(m.id))
    : [];
  const allPicked =
    pickedShown.length > 0 && pickedShown.length === visibleManga.length;

  const moveTo = async (to: ShelfMove) => {
    setMoveOpen(false);
    setMoving(true);
    setMoveFailed(false);
    const name = pickedShown.length === 1 ? pickedShown[0]!.name : "";
    const was = await useShelf.getState().moveMany(
      pickedShown.map((m) => m.id),
      to,
    );
    setMoving(false);
    if (!was) {
      setMoveFailed(true);
      return;
    }
    // Select stays on for the next lot
    setPicked(new Set());
    setMoved(was.length ? { to, was, name } : null);
  };
  const undoMove = async () => {
    if (!moved) return;
    const { was } = moved;
    setMoved(null);
    if (!(await useShelf.getState().placeMany(was))) setMoveFailed(true);
  };
  const movedShowing = Boolean(moved || moveFailed);
  const movedLine = moveFailed ? (
    "That didn't save. Try again."
  ) : moved ? (
    <>
      <span className={styles.seenName}>
        Moved {moved.name || `${moved.was.length} series`} to{" "}
        {MOVE_LABELS[moved.to]}
      </span>
      <button type="button" className={styles.seenUndo} onClick={undoMove}>
        Undo
      </button>
    </>
  ) : null;

  const goToAdd = () => navigator("/add", { viewTransition: true });

  // shortcuts, for anyone with a keyboard: / searches the shelf, n adds one.
  // Not while typing, with a dialog open, or with a modifier held
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
      const at = e.target as HTMLElement | null;
      if (at?.closest("input, textarea, select, [contenteditable]")) return;
      if (document.querySelector("dialog[open]")) return;
      if (e.key === "/") {
        e.preventDefault();
        const magnifier = document.querySelector<HTMLElement>(
          "[data-shelf-magnifier]",
        );
        if (magnifier?.getClientRects().length) magnifier.click();
        else
          document.querySelector<HTMLElement>("[data-shelf-search]")?.focus();
      } else if (e.key === "n") {
        e.preventDefault();
        navigator("/add", { viewTransition: true });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navigator]);

  const openHidden = () => navigator("/shelf?view=hidden");

  // the bottom pager takes them up to where the new page starts; the top
  // one is already there, so the page stays still under it
  const changePage = (index: number, scrollUp: boolean) => {
    setPage({ key: filterKey, index });
    if (scrollUp)
      document
        .getElementById("shelf-grid")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const shelfPage = visibleManga.slice(
    pageIndex * SHELF_PAGE_SIZE,
    (pageIndex + 1) * SHELF_PAGE_SIZE,
  );
  const pager = (scrollUp: boolean) => (
    <RangePager
      total={visibleManga.length}
      pageSize={SHELF_PAGE_SIZE}
      page={pageIndex}
      onChange={(index) => changePage(index, scrollUp)}
      label="Shelf pages"
      labelFor={(start, end) => `${start + 1}–${end + 1}`}
    />
  );

  if (loadError) {
    return (
      <div className={styles.emptyState}>
        <span className="printed mascot-spot" aria-hidden>
          <Mascot mood="panic" />
        </span>
        <p className={styles.emptyTitle}>Couldn't reach your shelf.</p>
        <p className={styles.emptyBody}>
          The server didn't answer. Give it a minute, then try again.
        </p>
        <button type="button" className="btn btn-primary" onClick={loadShelf}>
          Try again
        </button>
      </div>
    );
  }

  if (mangaData === null) return <LibrarySkeleton />;

  if (mangaData.length === 0) {
    return (
      <div className={`${styles.emptyState} fade-in`}>
        <span className="printed mascot-spot" aria-hidden>
          <Mascot mood="happy" />
        </span>
        <p className={styles.emptyTitle}>Nothing on the shelf yet.</p>
        <EmptyShelfUndo />
        <p className={styles.emptyBody}>
          Add whatever you're reading right now, and the chapter you're on.
          That's all it takes.
        </p>
        <button className="btn btn-primary btn-lg" onClick={goToAdd}>
          Add your first manga
        </button>
        <NavLink
          to="/import"
          className={`${styles.importLink} mx-auto mt-4 block w-fit`}
          viewTransition
        >
          Or import your list
        </NavLink>
      </div>
    );
  }

  // what this view of the New tab can say anything about: light novels have
  // volumes in English, but no chapters or Japanese volumes to follow
  const looked = mangaData.filter(
    (m) => releaseKind === "volumes" || !m.lightNovel,
  );
  const everyCheckFailed =
    allChecked &&
    mangaData.length > 0 &&
    mangaData.every((m) => outcomes[m.id] === "failed");
  const tabs = [
    { value: "all", label: "All", count: counts.all },
    { value: "ongoing", label: "Reading", count: counts.ongoing },
    { value: "finished", label: "Finished", count: counts.finished },
    { value: "planned", label: "To read", count: counts.planned },
    // what they own, volume by volume (VolumesView)
    { value: "volumes", label: "Volumes", count: counts.volumes },
    // what the last check found until this visit's check says otherwise, so
    // what's new shows without opening the tab. Nothing until they've ever looked
    ...(checksOn
      ? [
          {
            value: "new",
            label: "New",
            count: everyCheckFailed
              ? null
              : allChecked
                ? counts.new
                : (lastNewCount ?? (checked ? counts.new : null)),
          },
        ]
      : []),
  ];
  const kindCounts: Record<ReleaseKind, number> = {
    volumes: counts.newVolumes,
    chapters: counts.newChapters,
    japan: counts.newInJapan,
  };
  const seenOf = (m: Manga, kind: SeenKind) =>
    (kind === "volume"
      ? m.seenVolume
      : kind === "chapter"
        ? m.seenChapter
        : m.seenJapanVolume) ?? null;
  // this series, in this view, lists everything that's out as one entry
  const isGrouped = (m: Manga) => {
    const found = releases[m.id];
    return (
      (releaseKind === "chapters" ? found?.chapterMode : found?.volumeMode) ===
      "all"
    );
  };

  // what "Hide" on its card hides up to: everything that's out when the card
  // lists it all, otherwise the one it shows
  const newestOf = (m: Manga) => {
    const kind = SEEN_KIND[releaseKind];
    const found = releases[m.id];
    const grouped = isGrouped(m);
    return kind === "volume"
      ? grouped
        ? found?.latestVolume
        : found?.nextVolume
      : kind === "chapter"
        ? grouped
          ? found?.latestChapter
          : found?.nextChapter
        : found?.latestJapaneseVolume;
  };

  const handleSeen = async (m: Manga) => {
    const kind = SEEN_KIND[releaseKind];
    const grouped = isGrouped(m);
    const newest = newestOf(m);
    if (newest == null) return;
    const previous = seenOf(m, kind);
    const previousList = m.hiddenVolumes ?? [];
    setSeenFailed(false);
    // clearing what they've hidden is what puts it back on the list
    const restored = viewingHidden;
    const saved = await markSeen(
      m.id,
      kind,
      restored ? null : newest,
      kind === "volume" && (restored || grouped) ? [] : undefined,
    );
    if (saved) {
      setHidden({
        id: m.id,
        name: m.name,
        kind,
        previous,
        previousList,
        restored,
      });
    } else {
      setSeenFailed(true);
    }
  };

  const openManga = mangaData.find((m) => m.id === openRelease);

  // from the grouped list: part of it hidden. The last of it closes the list and
  // offers the undo, as hiding the whole card does
  const hideInModal = async (
    m: Manga,
    number: number | null,
    list?: number[],
  ) => {
    const kind = SEEN_KIND[releaseKind];
    const previous = seenOf(m, kind);
    const previousList = m.hiddenVolumes ?? [];
    const found = releases[m.id];
    const saved = await markSeen(m.id, kind, number, list);
    if (!saved) return false;
    const changed: Manga = {
      ...m,
      ...(kind === "volume" ? { seenVolume: number } : {}),
      ...(kind === "chapter" ? { seenChapter: number } : {}),
      ...(kind === "japan" ? { seenJapanVolume: number } : {}),
      ...(list ? { hiddenVolumes: list } : {}),
    };
    if (found && !isStillNew(kind, changed, found)) {
      setOpenRelease(null);
      setHidden({ id: m.id, name: m.name, kind, previous, previousList });
    }
    return true;
  };

  // everything hidden in this view, back on the list at once
  const unhideAll = async () => {
    const kind = SEEN_KIND[releaseKind];
    const series = mangaData.filter((m) =>
      isHiddenAs(releases[m.id], releaseKind),
    );
    const others = series.map((m) => ({
      id: m.id,
      previous: seenOf(m, kind),
      previousList: m.hiddenVolumes ?? [],
    }));
    setSeenFailed(false);
    const saved = await Promise.all(
      series.map((m) =>
        markSeen(m.id, kind, null, kind === "volume" ? [] : undefined),
      ),
    );
    if (saved.every(Boolean)) {
      setHidden({
        id: 0,
        name: `${series.length} series`,
        kind,
        previous: null,
        previousList: [],
        restored: true,
        others,
      });
    } else {
      setSeenFailed(true);
    }
  };

  // every card shown, hidden as its own "Hide" would. The undo puts each back
  // as it was
  const hideAll = async () => {
    const kind = SEEN_KIND[releaseKind];
    const series = visibleManga.flatMap((m) => {
      const newest = newestOf(m);
      return newest == null ? [] : [{ m, newest, grouped: isGrouped(m) }];
    });
    if (!series.length) return;
    const others = series.map(({ m }) => ({
      id: m.id,
      previous: seenOf(m, kind),
      previousList: m.hiddenVolumes ?? [],
    }));
    setSeenFailed(false);
    const saved = await Promise.all(
      series.map(({ m, newest, grouped }) =>
        markSeen(
          m.id,
          kind,
          newest,
          kind === "volume" && grouped ? [] : undefined,
        ),
      ),
    );
    if (saved.every(Boolean)) {
      setHidden({
        id: 0,
        name:
          series.length === 1 ? series[0]!.m.name : `${series.length} series`,
        kind,
        previous: null,
        previousList: [],
        others,
      });
    } else {
      setSeenFailed(true);
    }
  };

  const undoSeen = async () => {
    if (!hidden) return;
    const { id, kind, previous, previousList, others } = hidden;
    setHidden(null);
    if (others) {
      const saved = await Promise.all(
        others.map((o) =>
          markSeen(
            o.id,
            kind,
            o.previous,
            kind === "volume" ? o.previousList : undefined,
          ),
        ),
      );
      if (!saved.every(Boolean)) setSeenFailed(true);
      return;
    }
    const list = kind === "volume" ? previousList : undefined;
    if (!(await markSeen(id, kind, previous, list))) setSeenFailed(true);
    // back on the card it came from
    requestAnimationFrame(() =>
      document
        .querySelector<HTMLElement>(`[data-seen-id="${id}"]`)
        ?.focus({ preventScroll: true }),
    );
  };

  // what a card in the New tab says: what's out, and where they are, so the two
  // numbers can't be mixed up
  const newsFor = (m: Manga): CardNews | undefined => {
    if (!showingNew) return undefined;
    const found = releases[m.id];
    const volumeYours = ownedPhrase(m)
      ? `You own ${ownedPhrase(m)}`
      : found?.currentVolume
        ? `You're on vol. ${found.currentVolume}`
        : undefined;
    if (found && isGrouped(m)) {
      // what's hidden is everything, when looking at what's hidden
      const out = (left: number[], all: number[]) =>
        viewingHidden || !left.length ? all : left;
      const range = (prefix: string, numbers: number[]) =>
        numbers.length > 1
          ? `${prefix} ${numbers[0]}–${numbers.at(-1)}`
          : `${prefix} ${numbers[0]}`;
      if (releaseKind === "japan") {
        const shown = out(
          remainingJapanVolumes(m, found),
          found.outJapanVolumes,
        );
        return { text: `${range("Vol.", shown)} in Japan`, yours: volumeYours };
      }
      if (releaseKind === "chapters") {
        const left = remainingChapters(m, found);
        const first = found.nextChapter;
        const latest = found.latestChapter;
        return {
          text:
            viewingHidden || !left.length
              ? `Ch. ${first}–${latest} available`
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
    if (releaseKind === "japan") {
      return {
        text: `Vol. ${found?.latestJapaneseVolume} in Japan`,
        yours: volumeYours,
      };
    }
    if (releaseKind === "chapters") {
      const nextChapter = found?.nextChapter;
      return {
        text:
          nextChapter === found?.latestChapter
            ? `Ch. ${nextChapter} is out`
            : `Ch. ${nextChapter} available`,
        yours: m.bookmark ? `You're on ch. ${m.bookmark}` : undefined,
      };
    }
    // "is out" is news, so it's only for the newest
    const next = found?.nextVolume;
    return {
      text:
        next === found?.latestVolume
          ? `Vol. ${next} is out`
          : `Vol. ${next} available`,
      yours: volumeYours,
    };
  };
  // the next volume leads straight to its prices; there's nothing to do with it
  // but buy it. No catalog entry to go on: the details page, as usual
  const buyLinkFor = (m: Manga) => {
    const book = releases[m.id]?.nextVolumeBook;
    return showingNew && releaseKind === "volumes" && book && !isGrouped(m)
      ? volumePath(book.isbn13, book.title)
      : undefined;
  };

  const total = mangaData.length;
  const importLink = (
    <NavLink
      to="/import"
      data-tour="import-link"
      className={styles.importLink}
      viewTransition
    >
      Import your list
    </NavLink>
  );
  // a series with no saved place can't be called caught up, so it never shows
  // here. An empty tab has to say so, or it reads as "nothing's out"
  const unknownPlace = looked.filter((m) =>
    releaseKind === "chapters"
      ? !m.bookmark
      : !m.volumesOwned && !releases[m.id]?.currentVolume,
  ).length;
  const missingNumber =
    releaseKind === "chapters"
      ? "Add the chapter you're on and we'll tell you when the next one's out."
      : "Add the volumes you own and we'll tell you when the next one's out.";
  // every title failed, so "nothing new" would be a false comfort. A few failing
  // goes unsaid: the rest still stand, and they get tried again on the next visit
  const allFailed =
    showingNew &&
    !checking &&
    looked.length > 0 &&
    looked.every((m) => outcomes[m.id] === "failed");
  // the sites answered, but don't know these: they'll never show up on New
  const notFound = looked.filter((m) => outcomes[m.id] === "notFound").length;
  const bigFirstCheck = checking && !checkedBefore && total >= BIG_SHELF;
  // the check's progress: something to glance at, never the point of the page
  const progress = (
    <div
      className={styles.checkBar}
      role="progressbar"
      aria-label="Checking for new releases"
      aria-valuemin={0}
      aria-valuemax={total}
      aria-valuenow={checked}
    >
      <div
        className={styles.checkBarFill}
        style={{ width: `${(checked / total) * 100}%` }}
      />
    </div>
  );
  const bigShelfNote =
    bigFirstCheck && "The first check on a big shelf can take a few minutes.";

  return (
    <div className={`fade-in ${styles.library}`}>
      <div className={styles.pageHead}>
        <h1 className={styles.pageTitle}>Your shelf</h1>
        <div className={styles.pageActions}>
          {importLink}
          <NavLink
            to="/settings/profile#share"
            className="btn btn-ghost"
            viewTransition
          >
            Share
          </NavLink>
          <button className="btn btn-primary" data-tour="add" onClick={goToAdd}>
            + Add manga
          </button>
        </div>
      </div>

      <ShelfBar
        views={tabs}
        current={statusFilter}
        onPick={(value) => {
          setStatusFilter(value);
          writeSession("libraryStatus", value);
          // a new tab starts with Select off, so it never comes back by itself
          stopSelecting();
          if (wantHidden) navigator("/shelf", { replace: true });
        }}
        query={query}
        onQuery={setQuery}
        sortBy={sortBy}
        onSort={(value) => {
          setSortBy(value);
          writeSession("librarySort", value);
        }}
      />

      {/* pinned to the screen, since "Hide" is usually tapped far down the
          list. In a portal: the page's fade-in would otherwise pin it to the page */}
      {createPortal(
        <div role="status" ref={seenNote}>
          {showingNew && (hidden || seenFailed) && (
            <div className={styles.seenNote} data-over-add-button>
              {seenFailed ? (
                "That didn't save. Try again."
              ) : (
                <>
                  <span className={styles.seenName}>
                    {hidden?.restored ? "Back on the list" : "Hidden"}:{" "}
                    {hidden?.name}
                  </span>
                  <button
                    type="button"
                    className={styles.seenUndo}
                    onClick={undoSeen}
                  >
                    Undo
                  </button>
                </>
              )}
            </div>
          )}
        </div>,
        document.body,
      )}

      {/* Select's bar: what's ticked, and what to do with it. Pinned to the
          screen like the note above, so it's there however far down they are */}
      {selectOn &&
        createPortal(
          <div
            className={`${styles.selectDock}${undoShowing ? ` ${styles.selectBarRaised}` : ""}`}
            data-over-add-button
          >
            <div role="status" ref={movedNote}>
              {movedShowing && (
                <div className={styles.dockNote}>{movedLine}</div>
              )}
            </div>
            <div
              className={styles.selectBar}
              role="region"
              aria-label="Selected series"
            >
              <div className={styles.selectGroup}>
                <span className={styles.selectCount} role="status">
                  {pickedShown.length}
                  <span className="[@media(max-width:360px)]:sr-only">
                    {" "}
                    selected
                  </span>
                </span>
                {/* only with more than one page: otherwise it's Select all */}
                {visibleManga.length > SHELF_PAGE_SIZE && (
                  <button
                    type="button"
                    className={styles.selectLink}
                    onClick={() =>
                      setPicked((now) => {
                        const next = new Set(now);
                        const page = shelfPage.map((m) => m.id);
                        const whole = page.every((id) => now.has(id));
                        for (const id of page)
                          if (whole) next.delete(id);
                          else next.add(id);
                        return next;
                      })
                    }
                  >
                    {shelfPage.every((m) => picked.has(m.id))
                      ? "Clear page"
                      : "Select page"}
                  </button>
                )}
                <button
                  type="button"
                  className={styles.selectLink}
                  onClick={() =>
                    setPicked(
                      allPicked
                        ? new Set()
                        : new Set(visibleManga.map((m) => m.id)),
                    )
                  }
                >
                  {allPicked ? "Clear" : `Select all ${visibleManga.length}`}
                </button>
              </div>
              <div className={styles.selectActions}>
                <div className="relative" ref={moveMenu}>
                  <button
                    type="button"
                    className={styles.selectMove}
                    disabled={!pickedShown.length || moving}
                    aria-haspopup="menu"
                    aria-expanded={moveOpen}
                    onClick={() => setMoveOpen((open) => !open)}
                  >
                    {moving ? "Moving…" : "Move to"}
                    <ChevronDownIcon className="size-4" />
                  </button>
                  {moveOpen && (
                    <div className={styles.moveMenu} role="menu">
                      {(
                        [
                          ["finished", "Finished"],
                          ["planned", "To read"],
                          ["reading", "Reading"],
                        ] as const
                      ).map(([to, label]) => (
                        <button
                          key={to}
                          type="button"
                          role="menuitem"
                          className={styles.moveItem}
                          // the tab they're on already is where these are
                          disabled={
                            statusFilter === (to === "reading" ? "ongoing" : to)
                          }
                          onClick={() => moveTo(to)}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  className={styles.selectDelete}
                  disabled={!pickedShown.length}
                  onClick={() => setConfirmingDelete(true)}
                >
                  {/* one piece, so the button's gap doesn't split it; phones
                    show "Delete 2", so the bar stays short */}
                  <span>
                    Delete {pickedShown.length || ""}
                    <span className="upto-520:sr-only"> series</span>
                  </span>
                </button>
                <button
                  type="button"
                  className={styles.selectDone}
                  onClick={stopSelecting}
                  aria-label="Done selecting"
                >
                  <span className="upto-520:hidden">Done</span>
                  <CloseIcon className="hidden size-5 upto-520:block" />
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
      {/* "Moved 12 series to Finished · Undo": above the bar while selecting,
          where the Deleted note goes otherwise */}
      {!selectOn &&
        createPortal(
          <div role="status" ref={movedNote}>
            {movedShowing && (
              <div className={styles.seenNote} data-over-add-button>
                {movedLine}
              </div>
            )}
          </div>,
          document.body,
        )}
      {confirmingDelete && pickedShown.length > 0 && (
        <DeleteManyModal
          manga={pickedShown}
          onDelete={async () => {
            const done = await useShelf
              .getState()
              .removeMany(pickedShown.map((m) => m.id));
            if (done) {
              setConfirmingDelete(false);
              stopSelecting();
            }
            return done;
          }}
          onClose={() => setConfirmingDelete(false)}
        />
      )}

      {/* sighted readers see the cards change; this says so to everyone else */}
      <p className="sr-only" role="status">
        {mangaData.length ? `${visibleManga.length} shown` : ""}
      </p>

      {showingNew && (
        <div className={styles.releaseTools}>
          <div
            className={styles.releaseKinds}
            role="group"
            aria-label="Kind of release"
          >
            {(Object.keys(RELEASE_KINDS) as ReleaseKind[]).map((kind) => (
              <button
                key={kind}
                className={
                  releaseKind === kind
                    ? styles.releaseKindActive
                    : styles.releaseKind
                }
                aria-pressed={releaseKind === kind}
                onClick={() => {
                  setReleaseKind(kind);
                  writeSession("libraryReleaseKind", kind);
                }}
              >
                {RELEASE_KINDS[kind].label}{" "}
                {!allFailed && (
                  <span className={styles.releaseKindCount}>
                    {kindCounts[kind]}
                  </span>
                )}
              </button>
            ))}
          </div>
          <div className={styles.releaseAside}>
            {viewingHidden ? (
              <h2 className={styles.hiddenHeading}>Hidden ({hiddenCount})</h2>
            ) : (
              <p className={styles.releaseNote}>
                {RELEASE_KINDS[releaseKind].note}
              </p>
            )}
            <div className={styles.releaseLinks}>
              <NavLink
                to="/new-releases"
                className={styles.hiddenToggle}
                viewTransition
              >
                How this works
              </NavLink>
              {hiddenCount > 0 && !viewingHidden && (
                <button
                  type="button"
                  className={styles.hiddenToggle}
                  onClick={openHidden}
                >
                  Hidden ({hiddenCount})
                </button>
              )}
              {viewingHidden && (
                <>
                  <button
                    type="button"
                    className={styles.hiddenToggle}
                    onClick={unhideAll}
                  >
                    Unhide all
                  </button>
                  {/* back to what's new, without a stop here on the way back */}
                  <button
                    type="button"
                    className={styles.hiddenToggle}
                    onClick={() => navigator("/shelf", { replace: true })}
                  >
                    Back to new
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* a thin line above the cards once there are some, staying full once
          the check's done, with Hide all under it. With no cards yet it sits
          in the middle of the page, where the cards will be */}
      {showingNew && visibleManga.length > 0 && (
        <div className={styles.checkInline}>
          {progress}
          <div className={styles.checkRow}>
            <p className={styles.checkText} aria-live="polite">
              {checking
                ? `Checking ${checked} of ${total}`
                : `All ${total} checked`}
              {checking && bigShelfNote && ` · ${bigShelfNote}`}
            </p>
            {!viewingHidden && (
              <button
                type="button"
                className={styles.hiddenToggle}
                onClick={hideAll}
              >
                Hide all {visibleManga.length}
              </button>
            )}
          </div>
        </div>
      )}

      {checking && visibleManga.length === 0 && checked >= EARLY_CHECKS ? (
        // nothing new yet, a while in: one line, not a box that looks stuck
        <div className={styles.checkInline}>
          {progress}
          <p className={styles.checkText} aria-live="polite">
            {RELEASE_KINDS[releaseKind].waiting} · {checked} of {total} checked
            {bigShelfNote && (
              <span className={styles.checkAside}>{bigShelfNote}</span>
            )}
          </p>
        </div>
      ) : checking && visibleManga.length === 0 ? (
        <div className={styles.checkCentre}>
          <p className={styles.checkTitle}>Checking for new releases</p>
          {progress}
          <p className={styles.checkText} aria-live="polite">
            {checked} of {total}
            {bigShelfNote && (
              <span className={styles.checkAside}>{bigShelfNote}</span>
            )}
          </p>
        </div>
      ) : allFailed ? (
        <div className={styles.emptyState}>
          <span className="printed mascot-spot" aria-hidden>
            <Mascot mood="panic" />
          </span>
          <p className={styles.emptyTitle}>Couldn't check right now.</p>
          <p className={styles.emptyBody}>
            The sites we ask for releases didn't answer. Give it a minute.
          </p>
          <button className="btn btn-secondary" onClick={recheckReleases}>
            Try again
          </button>
        </div>
      ) : statusFilter === "volumes" ? (
        <VolumesView
          manga={visibleManga}
          searching={Boolean(query.trim())}
          resetKey={filterKey}
        />
      ) : showingNew && visibleManga.length === 0 && !query.trim() ? (
        <div className={styles.nothingNew} data-tour="shelf">
          <span className="printed mascot-spot" aria-hidden>
            <Mascot mood="happy" />
          </span>
          <p className={styles.nothingNewTitle}>
            {looked.length > 0 && unknownPlace === looked.length
              ? "We don't know where you're up to yet."
              : RELEASE_KINDS[releaseKind].emptyTitle}
          </p>
          {unknownPlace < looked.length && (
            <p className={styles.emptyBody}>
              {RELEASE_KINDS[releaseKind].emptyBody}
            </p>
          )}
          {unknownPlace > 0 && (
            <p className={styles.emptyBody}>
              {unknownPlace === looked.length
                ? missingNumber
                : `${unknownPlace} of your series can't show up here yet. ${missingNumber}`}
            </p>
          )}
          {looked.length < total && (
            <p className={styles.emptyBody}>
              Light novels aren't checked for new releases yet.
            </p>
          )}
          {!checking && notFound > 0 && (
            <p className={styles.emptyBody}>
              {notFound === looked.length
                ? "None of your series were found on the release sites, so nothing can show up here."
                : notFound === 1
                  ? "1 of your series wasn't found on the release sites, so it won't show up here."
                  : `${notFound} of your series weren't found on the release sites, so they won't show up here.`}
            </p>
          )}
        </div>
      ) : visibleManga.length === 0 ? (
        <div className={styles.emptyState}>
          <span className="printed mascot-spot" aria-hidden>
            <Mascot mood="confused" />
          </span>
          <p className={styles.emptyTitle}>No matches.</p>
          <p className={styles.emptyBody}>
            Nothing on your shelf fits that. Try another word or tab.
          </p>
          <button
            className="btn btn-secondary"
            onClick={() => {
              setQuery("");
              setStatusFilter("all");
              writeSession("libraryStatus", "all");
            }}
          >
            Show everything
          </button>
        </div>
      ) : (
        <>
          <div className={styles.gridTools}>
            {pager(false)}
            {/* while selecting, the bar's Done (or Escape) is the way out */}
            {canSelect && !selectOn && (
              <button
                type="button"
                className={styles.selectToggle}
                onClick={() => setSelecting(true)}
              >
                Select
              </button>
            )}
          </div>
          <div
            id="shelf-grid"
            className={
              rowsChosen
                ? styles.rowsGrid
                : showingNew
                  ? styles.newGrid
                  : styles.classContainer
            }
            onClickCapture={saveSpot}
            data-tour="shelf"
          >
            {shelfPage.map((currentManga, i) => (
              <div
                key={currentManga.id}
                className={
                  rowsChosen
                    ? styles.cardRowAlways
                    : showingNew
                      ? styles.cardAsRow
                      : styles.cardWithSeen
                }
              >
                <MangaCard
                  currentManga={currentManga}
                  news={newsFor(currentManga)}
                  linkTo={buyLinkFor(currentManga)}
                  onOpen={
                    showingNew && !viewingHidden && isGrouped(currentManga)
                      ? () => setOpenRelease(currentManga.id)
                      : undefined
                  }
                  detailsSearch={
                    !showingNew
                      ? undefined
                      : releaseKind === "japan"
                        ? "?edition=japan"
                        : releaseKind === "chapters"
                          ? "?new=chapter"
                          : undefined
                  }
                  index={i}
                  compact={rowsChosen}
                  latestChapter={
                    releases[currentManga.id]?.latestChapter ??
                    currentManga.latestChapter
                  }
                  select={
                    selectOn
                      ? {
                          checked: picked.has(currentManga.id),
                          onToggle: () => togglePicked(currentManga.id),
                        }
                      : undefined
                  }
                />
                {showingNew && (
                  <button
                    type="button"
                    className={rowsChosen ? styles.seenBtnRow : styles.seenBtn}
                    aria-label={`${viewingHidden ? "Unhide" : isGrouped(currentManga) ? "Hide all" : "Hide"}: ${currentManga.name}`}
                    data-seen-id={currentManga.id}
                    onClick={() => handleSeen(currentManga)}
                  >
                    {!viewingHidden && <CheckIcon />}
                    {viewingHidden
                      ? "Unhide"
                      : isGrouped(currentManga)
                        ? "Hide all"
                        : "Hide"}
                  </button>
                )}
              </div>
            ))}
          </div>
          {visibleManga.length > SHELF_PAGE_SIZE && (
            <div className={styles.pagerBottom}>{pager(true)}</div>
          )}
        </>
      )}

      {/* out of the way on phones, where the top of the page is for the manga */}

      {showingNew && openManga && releases[openManga.id] && (
        <ReleaseModal
          manga={openManga}
          found={releases[openManga.id]!}
          kind={SEEN_KIND[releaseKind]}
          onHide={(number, list) => hideInModal(openManga, number, list)}
          onHideAll={() => {
            setOpenRelease(null);
            handleSeen(openManga);
          }}
          onClose={() => setOpenRelease(null)}
        />
      )}

      {!showingNew && <AddButton onClick={goToAdd} />}

      <ReleaseTip
        // not over the select bar or the undo note, which share its spot
        enabled={hasManga && !showingNew && !selecting && !undoShowing}
        onCheck={() => {
          setStatusFilter("new");
          writeSession("libraryStatus", "new");
        }}
      />

      <ViewPeek
        series={mangaData.length}
        rows={rowsChosen}
        blocked={selecting || undoShowing || Boolean(hidden) || movedShowing}
        onChoose={(view) => {
          setRowsChosen(view === "rows");
          savePrefs({ shelfView: view }, true);
        }}
      />
    </div>
  );
}

// on small screens, adding sits within reach of a thumb. In a portal for the same
// reason as the note above
// slides away while they scroll down the shelf, so it doesn't sit over the
// covers they're reading; back as soon as they scroll up or stop
const ADD_BACK_AFTER_MS = 700;
function AddButton({ onClick }: { onClick: () => void }) {
  const [away, setAway] = useState(false);
  useEffect(() => {
    let last = window.scrollY;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onScroll = () => {
      const y = window.scrollY;
      if (y > last + 4 && y > 120) setAway(true);
      else if (y < last - 4) setAway(false);
      last = y;
      clearTimeout(timer);
      timer = setTimeout(() => setAway(false), ADD_BACK_AFTER_MS);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      clearTimeout(timer);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);
  return createPortal(
    <button
      type="button"
      className={`${styles.addButton}${away ? ` ${styles.addButtonAway}` : ""}`}
      aria-label="Add manga"
      data-tour="add"
      onClick={onClick}
    >
      <PlusIcon aria-hidden />
    </button>,
    document.body,
  );
}

function LibrarySkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading">
      <SlowLoadQuote />
      <div className={`skeleton ${styles.skeletonTitle}`} />
      <div className={styles.classContainer}>
        {Array.from({ length: 10 }, (_, i) => (
          <MangaCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}

function GuestHero() {
  return (
    <>
      <div className={`${styles.guestContainer} fade-in`}>
        <div className={styles.guestCopy}>
          <h1 className={styles.guestTitle}>
            Your <span className={styles.titleHit}>shelf</span> lives here once
            you sign up.
          </h1>
          <p className={styles.guestSub}>
            Keep your place in every series, track the volumes you own, and see
            when the next one's out and what it costs.
          </p>
          <div className={styles.guestActions}>
            <NavLink
              to="/signup"
              className="btn btn-primary upto-720: p-3 "
              viewTransition
            >
              Start your shelf
            </NavLink>
            <NavLink
              to="/signin"
              className="btn p-3 upto-720:hidden "
              viewTransition
            >
              Sign in
            </NavLink>
            <TakeTourButton />
          </div>
        </div>

        {/* a manga page: one panel per thing the app does */}
        <ol className={`${styles.page} printed`} aria-label="What you can do">
          <li className={styles.panelWide}>
            <div className={`${styles.art} ${styles.speed}`} aria-hidden>
              <span className={styles.bigCh}>
                <small>ch.</small>374
              </span>
            </div>
            <span className={`${styles.sfx} ${styles.sfxA}`} aria-hidden>
              Bookmarked!
            </span>
            <p className={styles.caption}>Save the chapter you're on</p>
          </li>

          <li className={styles.panel}>
            <div className={`${styles.art} ${styles.tone}`} aria-hidden>
              <span className={styles.panelStars}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <StarIcon key={n} filled />
                ))}
              </span>
            </div>
            <span className={`${styles.sfx} ${styles.sfxB}`} aria-hidden>
              Peak!
            </span>
            <p className={styles.caption}>Rate what you finish</p>
          </li>

          <li className={styles.panel}>
            <div className={`${styles.art} ${styles.tone}`} aria-hidden>
              <span className={styles.covers}>
                <span>Vol. 1</span>
                <span>Vol. 2</span>
                <span>Vol. 3</span>
              </span>
            </div>
            <span className={`${styles.sfx} ${styles.sfxC}`} aria-hidden>
              Found it!
            </span>
            <p className={styles.caption}>Covers and genres fill in</p>
          </li>

          <li className={styles.panelWide}>
            <div className={`${styles.art} ${styles.tone}`} aria-hidden>
              <span className={styles.bigCh}>
                <small>vol.</small>25
              </span>
            </div>
            <span className={`${styles.sfx} ${styles.sfxD}`} aria-hidden>
              It's out!
            </span>
            <p className={styles.caption}>See which series have new volumes</p>
          </li>
        </ol>
      </div>
    </>
  );
}
