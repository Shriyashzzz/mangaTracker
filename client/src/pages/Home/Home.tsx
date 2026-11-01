import { useState, useEffect, useMemo, useRef } from "react";
import MangaCard, {
  MangaCardSkeleton,
} from "../../components/mangaCard/MangaCard";

import { homeStyles as styles } from "./styles";
import { NavLink, useNavigate } from "react-router";
import { SearchIcon, StarIcon } from "../../components/icons/Icons";
import { apiFetch } from "../../lib/api";
import RangePager from "../../components/rangePager/RangePager";
import Mascot from "../../components/mascot/Mascot";
import SlowLoadQuote from "../../components/slowLoadQuote/SlowLoadQuote";
import { usePrivatePage } from "../../lib/seo";
import { getShelfPriceTags } from "../../lib/prices";
import { getReleases } from "../../lib/shelf";
import type { Manga, ReleaseStatus, ShelfPrice } from "../../lib/types";
import { useAuth } from "../../store/auth";

const SHELF_PAGE_SIZE = 30;

const SORT_OPTIONS = [
  { value: "", label: "Last bookmarked" },
  { value: "rating-dsc", label: "Highest rated" },
  { value: "rating-asc", label: "Lowest rated" },
  { value: "ch-dsc", label: "Most chapters read" },
  { value: "ch-asc", label: "Fewest chapters read" },
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

function Library() {
  const [mangaData, setMangaData] = useState<Manga[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState(() =>
    readSession("libraryStatus", "all"),
  );
  const [sortBy, setSortBy] = useState(() => readSession("librarySort", ""));
  const navigator = useNavigate();
  // the shelf shows one block of manga at a time; any change to the tab,
  // search or sort starts again from the first block
  const [releaseKind, setReleaseKind] = useState(() =>
    readSession("libraryReleaseKind", "volumes"),
  );
  const filterKey = `${statusFilter}|${releaseKind}|${sortBy}|${query.trim().toLowerCase()}`;
  const [page, setPage] = useState({ key: filterKey, index: 0 });
  const pageIndex = page.key === filterKey ? page.index : 0;

  useEffect(() => {
    async function fetchMangaData() {
      try {
        const response = await apiFetch("/api/manga");
        if (!response.ok) throw new Error(response.statusText);
        const { manga } = (await response.json()) as { manga: Manga[] };
        setMangaData(manga);
      } catch {
        setLoadError(true);
      }
    }
    fetchMangaData();
  }, []);

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

  // what's new for each manga. Only asked for once the New tab is opened, and
  // one title at a time, since the server has to ask other sites about each
  // title it hasn't seen lately. Leaving the tab stops the checking
  const showingNew = statusFilter === "new";
  const [releases, setReleases] = useState<Record<number, ReleaseStatus | null>>(
    {},
  );
  const checkedIds = useRef(new Set<number>());
  useEffect(() => {
    if (!showingNew || !mangaData?.length) return;
    const controller = new AbortController();
    (async () => {
      for (const { id } of mangaData) {
        if (checkedIds.current.has(id)) continue;
        const status = await getReleases(id, controller.signal)
          .then((found) => found.releaseStatus)
          .catch(() => null);
        if (controller.signal.aborted) return;
        checkedIds.current.add(id);
        setReleases((current) => ({ ...current, [id]: status }));
      }
    })();
    return () => controller.abort();
  }, [mangaData, showingNew]);
  const checked = Object.keys(releases).length;
  const checking = showingNew && checked < (mangaData?.length ?? 0);

  const counts = useMemo(() => {
    const list = mangaData ?? [];
    const finished = list.filter((m) => m.status).length;
    const newVolumes = list.filter((m) => releases[m.id]?.hasNewVolume).length;
    const newChapters = list.filter((m) => releases[m.id]?.hasNewChapter).length;
    return {
      all: list.length,
      ongoing: list.length - finished,
      finished,
      newVolumes,
      newChapters,
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
      list = list.filter((m) =>
        releaseKind === "chapters"
          ? releases[m.id]?.hasNewChapter
          : releases[m.id]?.hasNewVolume,
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
      case "rating-asc":
        list.sort((a, b) => (a.rating ?? 0) - (b.rating ?? 0));
        break;
      case "ch-dsc":
        list.sort((a, b) => (b.bookmark ?? 0) - (a.bookmark ?? 0));
        break;
      case "ch-asc":
        list.sort((a, b) => (a.bookmark ?? 0) - (b.bookmark ?? 0));
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
          The server didn't answer. Give it a minute and refresh.
        </p>
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
  const releaseKinds = [
    { value: "volumes", label: "New volumes", count: counts.newVolumes },
    { value: "chapters", label: "New chapters", count: counts.newChapters },
  ];
  // what a card in the New tab has come out for
  const newsFor = (m: Manga) => {
    if (!showingNew) return undefined;
    return releaseKind === "chapters"
      ? `Ch. ${releases[m.id]?.latestChapter} is out`
      : `Vol. ${releases[m.id]?.latestVolume} is out`;
  };

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
            <span>Sort</span>
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

      {showingNew && (
        <div className={styles.releaseTools}>
          <div
            className={styles.releaseKinds}
            role="group"
            aria-label="Kind of release"
          >
            {releaseKinds.map((k) => (
              <button
                key={k.value}
                className={
                  releaseKind === k.value
                    ? styles.releaseKindActive
                    : styles.releaseKind
                }
                aria-pressed={releaseKind === k.value}
                onClick={() => {
                  setReleaseKind(k.value);
                  writeSession("libraryReleaseKind", k.value);
                }}
              >
                {k.label} <span className={styles.releaseKindCount}>{k.count}</span>
              </button>
            ))}
          </div>
          <p className={styles.releaseNote} role="status">
            {checking
              ? `Checking for new releases, ${checked} of ${mangaData.length}…`
              : "English releases only."}
          </p>
        </div>
      )}

      {showingNew && visibleManga.length === 0 && checking ? null : showingNew &&
        visibleManga.length === 0 &&
        !query.trim() ? (
        <div className={styles.emptyState}>
          <span className="printed mascot-spot" aria-hidden>
            <Mascot mood="happy" />
          </span>
          <p className={styles.emptyTitle}>
            {releaseKind === "chapters"
              ? "No new English chapters."
              : "No new English volumes."}
          </p>
          <p className={styles.emptyBody}>
            {releaseKind === "chapters"
              ? "You've read up to the newest one we can find."
              : "You own up to the newest one we can find."}
          </p>
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
          <div id="shelf-grid" className={styles.classContainer}>
            {shelfPage.map((currentManga, i) => (
              <MangaCard
                key={currentManga.id}
                currentManga={currentManga}
                priceTag={priceTags[currentManga.id]}
                news={newsFor(currentManga)}
                index={i}
              />
            ))}
          </div>
          {visibleManga.length > SHELF_PAGE_SIZE && (
            <div className={styles.pagerBottom}>{pager}</div>
          )}
        </>
      )}
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
        </ol>
      </div>
    </>
  );
}
