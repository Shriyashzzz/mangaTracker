import { useState, useEffect, useMemo } from "react";
import MangaCard, {
  MangaCardSkeleton,
  type CardNews,
} from "../../components/mangaCard/MangaCard";

import { homeStyles as styles } from "./styles";
import { NavLink, useNavigate } from "react-router";
import { CheckIcon, SearchIcon, StarIcon } from "../../components/icons/Icons";
import RangePager from "../../components/rangePager/RangePager";
import Mascot from "../../components/mascot/Mascot";
import SlowLoadQuote from "../../components/slowLoadQuote/SlowLoadQuote";
import { usePrivatePage } from "../../lib/seo";
import { getShelfPriceTags, volumePath } from "../../lib/prices";
import type { Manga, ShelfPrice } from "../../lib/types";
import { useAuth } from "../../store/auth";
import { useShelf } from "../../store/shelf";
import { readLocal, writeLocal } from "../../lib/prefs";
import { CHECKED_BEFORE_KEY, type SeenKind } from "../../lib/shelf";
import ReleaseTip from "../../components/whatsNew/ReleaseTip";

const SHELF_PAGE_SIZE = 30;
// shelves this size get a heads-up that their first release check is slow
const BIG_SHELF = 10;

// what each side of the New tab's switch shows, and how it says there's nothing
const RELEASE_KINDS = {
  volumes: {
    label: "Volumes",
    note: "English releases only. Japan may be ahead.",
    emptyTitle: "No new volumes. Your wallet lives!",
    emptyBody:
      "Nothing new to show for now. Your shelf gets a day off.",
  },
  chapters: {
    label: "Chapters",
    note: "English releases only. Japan may be ahead.",
    emptyTitle: "Nothing new to read. Go touch grass!",
    emptyBody:
      "Nothing new to show for now. Check back soon.",
  },
  japan: {
    label: "In Japan",
    note: "Out in Japan, maybe not in English yet.",
    emptyTitle: "Japan has nothing on you. Yet!",
    emptyBody:
      "No volumes in Japan to show for now.",
  },
} as const;
type ReleaseKind = keyof typeof RELEASE_KINDS;

const SORT_OPTIONS = [
  { value: "", label: "Last bookmarked" },
  { value: "rating-dsc", label: "Highest rated" },
  { value: "ch-dsc", label: "Most chapters read" },
  { value: "name-asc", label: "Title, A to Z" },
];

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
const SEEN_KIND = { volumes: "volume", chapters: "chapter", japan: "japan" } as const;

function Library() {
  const mangaData = useShelf((s) => s.manga);
  const loadError = useShelf((s) => s.loadFailed);
  const releases = useShelf((s) => s.releases);
  const loadShelf = useShelf((s) => s.load);
  const checkReleases = useShelf((s) => s.checkReleases);
  const recheckReleases = useShelf((s) => s.recheckReleases);
  const [spot] = useState(readSpot);
  const [query, setQuery] = useState(spot?.query ?? "");
  const [statusFilter, setStatusFilter] = useState(() =>
    readSession("libraryStatus", "all"),
  );
  const [sortBy, setSortBy] = useState(() => {
    const saved = readSession("librarySort", "");
    return SORT_OPTIONS.some((o) => o.value === saved) ? saved : "";
  });
  const navigator = useNavigate();
  // the shelf shows one block of manga at a time; any change to the tab,
  // search or sort starts again from the first block
  const [releaseKind, setReleaseKind] = useState<ReleaseKind>(() => {
    const saved = readSession("libraryReleaseKind", "volumes");
    return saved in RELEASE_KINDS ? (saved as ReleaseKind) : "volumes";
  });
  const filterKey = `${statusFilter}|${releaseKind}|${sortBy}|${query.trim().toLowerCase()}`;
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
      JSON.stringify({ y: window.scrollY, key: filterKey, index: pageIndex, query }),
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

  // the last "Seen it", for its undo; or a save that failed
  const markSeen = useShelf((s) => s.markSeen);
  const [hidden, setHidden] = useState<{
    id: number;
    name: string;
    kind: SeenKind;
    previous: number | null;
  } | null>(null);
  const [seenFailed, setSeenFailed] = useState(false);

  // price lines for the cards, once the shelf is in. Nice to have: the
  // shelf works the same without them
  const [priceTags, setPriceTags] = useState<Record<number, ShelfPrice>>({});
  const hasManga = Boolean(mangaData?.length);
  useEffect(() => {
    if (!hasManga) return;
    const controller = new AbortController();
    getShelfPriceTags(controller.signal)
      .then(setPriceTags)
      .catch(() => {});
    return () => controller.abort();
  }, [hasManga]);

  // what's new for each manga. Only asked for once the New tab is opened; after
  // that it carries on even if they leave, and new titles get picked up
  const showingNew = statusFilter === "new";
  useEffect(() => {
    if (showingNew && mangaData?.length) checkReleases();
  }, [mangaData, releases, showingNew, checkReleases]);
  const checked = (mangaData ?? []).filter((m) => m.id in releases).length;
  const checking = showingNew && checked < (mangaData?.length ?? 0);
  const allChecked = checked > 0 && checked >= (mangaData?.length ?? 0);
  const [checkedBefore] = useState(() => readLocal(CHECKED_BEFORE_KEY) !== null);
  useEffect(() => {
    if (allChecked) writeLocal(CHECKED_BEFORE_KEY, "yes");
  }, [allChecked]);

  const counts = useMemo(() => {
    const list = mangaData ?? [];
    const finished = list.filter((m) => m.status).length;
    const newVolumes = list.filter((m) => releases[m.id]?.hasNewVolume).length;
    const newChapters = list.filter((m) => releases[m.id]?.hasNewChapter).length;
    const newInJapan = list.filter(
      (m) => releases[m.id]?.hasNewJapaneseVolume,
    ).length;
    return {
      all: list.length,
      ongoing: list.length - finished,
      finished,
      newVolumes,
      newChapters,
      newInJapan,
      new: list.filter(
        (m) => releases[m.id]?.hasNewVolume || releases[m.id]?.hasNewChapter,
      ).length,
    };
  }, [mangaData, releases]);

  const visibleManga = useMemo(() => {
    let list = [...(mangaData ?? [])];
    if (statusFilter === "finished") list = list.filter((m) => m.status);
    if (statusFilter === "ongoing") list = list.filter((m) => !m.status);
    if (statusFilter === "new") {
      list = list.filter((m) => {
        const found = releases[m.id];
        if (releaseKind === "chapters") return found?.hasNewChapter;
        if (releaseKind === "japan") return found?.hasNewJapaneseVolume;
        return found?.hasNewVolume;
      });
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
  }, [mangaData, releases, releaseKind, statusFilter, sortBy, query]);

  const goToAdd = () => navigator("/add", { viewTransition: true });

  const changePage = (index: number) => {
    setPage({ key: filterKey, index });
    document
      .getElementById("shelf-grid")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const shelfPage = visibleManga.slice(
    pageIndex * SHELF_PAGE_SIZE,
    (pageIndex + 1) * SHELF_PAGE_SIZE,
  );
  const pager = (
    <RangePager
      total={visibleManga.length}
      pageSize={SHELF_PAGE_SIZE}
      page={pageIndex}
      onChange={changePage}
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
        <p className={styles.emptyBody}>
          Add whatever you're reading right now, and the chapter you're on.
          That's all it takes.
        </p>
        <button className="btn btn-primary btn-lg" onClick={goToAdd}>
          Add your first manga
        </button>
      </div>
    );
  }

  const tabs = [
    { value: "all", label: "Everything", count: counts.all },
    { value: "ongoing", label: "Reading", count: counts.ongoing },
    { value: "finished", label: "Finished", count: counts.finished },
    // no number until they've looked: we don't know it yet
    { value: "new", label: "New", count: checked ? counts.new : null },
  ];
  const kindCounts: Record<ReleaseKind, number> = {
    volumes: counts.newVolumes,
    chapters: counts.newChapters,
    japan: counts.newInJapan,
  };
  const handleSeen = async (m: Manga) => {
    const kind = SEEN_KIND[releaseKind];
    const found = releases[m.id];
    const newest =
      kind === "volume"
        ? found?.nextVolume
        : kind === "chapter"
          ? found?.latestChapter
          : found?.latestJapaneseVolume;
    if (newest == null) return;
    const previous =
      (kind === "volume"
        ? m.seenVolume
        : kind === "chapter"
          ? m.seenChapter
          : m.seenJapanVolume) ?? null;
    setSeenFailed(false);
    const saved = await markSeen(m.id, kind, newest);
    if (saved) setHidden({ id: m.id, name: m.name, kind, previous });
    else setSeenFailed(true);
  };

  const undoSeen = async () => {
    if (!hidden) return;
    const { id, kind, previous } = hidden;
    setHidden(null);
    if (!(await markSeen(id, kind, previous))) setSeenFailed(true);
  };

  // what a card in the New tab says: what's out, and where they are, so the two
  // numbers can't be mixed up
  const newsFor = (m: Manga): CardNews | undefined => {
    if (!showingNew) return undefined;
    const found = releases[m.id];
    const volumeYours = m.volumesOwned
      ? `You own up to vol. ${m.volumesOwned}`
      : found?.currentVolume
        ? `You're on vol. ${found.currentVolume}`
        : undefined;
    if (releaseKind === "japan") {
      return {
        text: `Vol. ${found?.latestJapaneseVolume} in Japan`,
        yours: volumeYours,
      };
    }
    if (releaseKind === "chapters") {
      return {
        text: `Ch. ${found?.latestChapter} is out`,
        yours: m.bookmark ? `You're on ch. ${m.bookmark}` : undefined,
      };
    }
    return { text: `Vol. ${found?.nextVolume} is out`, yours: volumeYours };
  };
  // the next volume leads straight to its prices; there's nothing to do with it
  // but buy it. No catalog entry to go on: the details page, as usual
  const buyLinkFor = (m: Manga) => {
    const book = releases[m.id]?.nextVolumeBook;
    return showingNew && releaseKind === "volumes" && book
      ? volumePath(book.isbn13, book.title)
      : undefined;
  };

  const total = mangaData.length;
  // a series with no saved place can't be called caught up, so it never shows
  // here. An empty tab has to say so, or it reads as "nothing's out"
  const unknownPlace = mangaData.filter((m) =>
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
    total > 0 &&
    mangaData.every((m) => releases[m.id] === null);
  const bigFirstCheck =
    checking && !checkedBefore && total >= BIG_SHELF;
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
    <div className="fade-in">
      <div className={styles.pageHead}>
        <h1 className={styles.pageTitle}>Your shelf</h1>
        <button className="btn btn-primary" onClick={goToAdd}>
          + Add manga
        </button>
      </div>

      <div className={styles.toolbar}>
        <div className={styles.tabs} role="group" aria-label="Status">
          {tabs.map((t) => (
            <button
              key={t.value}
              className={
                statusFilter === t.value ? styles.tabActive : styles.tab
              }
              aria-pressed={statusFilter === t.value}
              onClick={() => {
                setStatusFilter(t.value);
                writeSession("libraryStatus", t.value);
              }}
            >
              {t.label}{" "}
              {t.count != null && (
                <span className={styles.count}>{t.count}</span>
              )}
            </button>
          ))}
        </div>

        <div className={styles.tools}>
          <label className={styles.search}>
            <SearchIcon />
            <span className="sr-only">Search your shelf</span>
            <input
              type="search"
              placeholder="Find a title or genre"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          <label className={styles.sort}>
            <span className="upto-520:sr-only">Sort</span>
            <select
              value={sortBy}
              onChange={(e) => {
                setSortBy(e.target.value);
                writeSession("librarySort", e.target.value);
              }}
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {showingNew && (hidden || seenFailed) && (
        <p className={styles.seenNote} role="status">
          {seenFailed ? (
            "That didn't save. Try again."
          ) : (
            <>
              Hidden: {hidden?.name}.{" "}
              <button type="button" className={styles.seenUndo} onClick={undoSeen}>
                Undo
              </button>
            </>
          )}
        </p>
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
                <span className={styles.releaseKindCount}>
                  {kindCounts[kind]}
                </span>
              </button>
            ))}
          </div>
          <p className={styles.releaseNote}>{RELEASE_KINDS[releaseKind].note}</p>
        </div>
      )}

      {/* a thin line above the cards once there are some; with none yet it
          sits in the middle of the page, where the cards will be */}
      {checking && visibleManga.length > 0 && (
        <div className={styles.checkInline}>
          {progress}
          <p className={styles.checkText} aria-live="polite">
            Checking {checked} of {total}
            {bigShelfNote && ` · ${bigShelfNote}`}
          </p>
        </div>
      )}

      {checking && visibleManga.length === 0 ? (
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
      ) : showingNew && visibleManga.length === 0 && !query.trim() ? (
        <div className={styles.nothingNew}>
          <span className="printed mascot-spot" aria-hidden>
            <Mascot mood="happy" />
          </span>
          <p className={styles.nothingNewTitle}>
            {unknownPlace === total
              ? "We don't know where you're up to yet."
              : RELEASE_KINDS[releaseKind].emptyTitle}
          </p>
          {unknownPlace < total && (
            <p className={styles.emptyBody}>
              {RELEASE_KINDS[releaseKind].emptyBody}
            </p>
          )}
          {unknownPlace > 0 && (
            <p className={styles.emptyBody}>
              {unknownPlace === total
                ? missingNumber
                : `${unknownPlace} of your series can't show up here yet. ${missingNumber}`}
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
          {pager}
          <div
            id="shelf-grid"
            className={styles.classContainer}
            onClickCapture={saveSpot}
          >
            {shelfPage.map((currentManga, i) => (
              <div key={currentManga.id} className={styles.cardWithSeen}>
                <MangaCard
                    currentManga={currentManga}
                  priceTag={priceTags[currentManga.id]}
                  news={newsFor(currentManga)}
                  linkTo={buyLinkFor(currentManga)}
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
                />
                {showingNew && (
                  <button
                    type="button"
                    className={styles.seenBtn}
                    aria-label={`Seen it: ${currentManga.name}`}
                    onClick={() => handleSeen(currentManga)}
                  >
                    <CheckIcon />
                    Seen it
                  </button>
                )}
              </div>
            ))}
          </div>
          {visibleManga.length > SHELF_PAGE_SIZE && (
            <div className={styles.pagerBottom}>{pager}</div>
          )}
        </>
      )}

      <ReleaseTip
        enabled={hasManga && !showingNew}
        onCheck={() => {
          setStatusFilter("new");
          writeSession("libraryStatus", "new");
        }}
      />
    </div>
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
            Never lose your <span className={styles.titleHit}>chapter</span>{" "}
            again.
          </h1>
          <div className={styles.guestActions}>
            <NavLink
              to="/signup"
              className="btn btn-primary btn-lg"
              viewTransition
            >
              Start your shelf
            </NavLink>
            <NavLink
              to="/signin"
              className="btn btn-ghost btn-lg"
              viewTransition
            >
              Sign in
            </NavLink>
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
