import { useState, useEffect, useMemo } from "react";
import MangaCard, {
  MangaCardSkeleton,
} from "../../components/mangaCard/MangaCard";
import styles from "./Home.module.css";
import { NavLink, useNavigate, useOutletContext } from "react-router";
import { SearchIcon, StarIcon } from "../../components/icons/Icons";
import { apiFetch } from "../../lib/api";

const SORT_OPTIONS = [
  { value: "", label: "Last bookmarked" },
  { value: "rating-dsc", label: "Highest rated" },
  { value: "rating-asc", label: "Lowest rated" },
  { value: "ch-dsc", label: "Most chapters read" },
  { value: "ch-asc", label: "Fewest chapters read" },
  { value: "name-asc", label: "Title, A to Z" },
];

// sessionStorage can throw in locked-down browsers, the filters just won't persist then
const readSession = (key, fallback) => {
  try {
    return sessionStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
};
const writeSession = (key, value) => {
  try {
    sessionStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
};

export default function Home() {
  const [isSignedIn] = useOutletContext();

  if (isSignedIn === null) {
    return <LibrarySkeleton />;
  }
  return isSignedIn ? <Library /> : <GuestHero />;
}

function Library() {
  const [mangaData, setMangaData] = useState(null);
  const [loadError, setLoadError] = useState(false);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState(() =>
    readSession("libraryStatus", "all"),
  );
  const [sortBy, setSortBy] = useState(() => readSession("librarySort", ""));
  const navigator = useNavigate();

  useEffect(() => {
    async function fetchMangaData() {
      try {
        const response = await apiFetch("/api/mangadata");
        if (!response.ok) throw new Error(response.statusText);
        const mangaObj = await response.json();
        setMangaData(mangaObj.mangaData);
      } catch {
        setLoadError(true);
      }
    }
    fetchMangaData();
  }, []);

  const counts = useMemo(() => {
    const list = mangaData ?? [];
    const finished = list.filter((m) => m.status).length;
    return { all: list.length, ongoing: list.length - finished, finished };
  }, [mangaData]);

  const visibleManga = useMemo(() => {
    let list = [...(mangaData ?? [])];
    if (statusFilter === "finished") list = list.filter((m) => m.status);
    if (statusFilter === "ongoing") list = list.filter((m) => !m.status);

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
        list.sort((a, b) => b.rating - a.rating);
        break;
      case "rating-asc":
        list.sort((a, b) => a.rating - b.rating);
        break;
      case "ch-dsc":
        list.sort((a, b) => b.bookmark - a.bookmark);
        break;
      case "ch-asc":
        list.sort((a, b) => a.bookmark - b.bookmark);
        break;
      case "name-asc":
        list.sort((a, b) => a.name.localeCompare(b.name));
        break;
    }
    return list;
  }, [mangaData, statusFilter, sortBy, query]);

  const goToAdd = () => navigator("/add", { viewTransition: true });

  if (loadError) {
    return (
      <div className={styles.emptyState}>
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
  ];

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
              className={statusFilter === t.value ? styles.tabActive : ""}
              aria-pressed={statusFilter === t.value}
              onClick={() => {
                setStatusFilter(t.value);
                writeSession("libraryStatus", t.value);
              }}
            >
              {t.label} <span className={styles.count}>{t.count}</span>
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

      {visibleManga.length === 0 ? (
        <div className={styles.emptyState}>
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
        <div className={styles.classContainer}>
          {visibleManga.map((currentManga, i) => (
            <MangaCard
              key={currentManga.id}
              currentManga={currentManga}
              index={i}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function LibrarySkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading">
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
    <div className={`${styles.guestContainer} fade-in`}>
      <div className={styles.guestCopy}>
        <h1 className={styles.guestTitle}>
          Never lose your <span className={styles.titleHit}>chapter</span>{" "}
          again!
        </h1>
        <p className={styles.bubble}>
          Reading ten series at once? Save the chapter you're on, rate what you
          finish, and jump back in right where you stopped.
        </p>
        <div className={styles.guestActions}>
          <NavLink
            to="/signup"
            className="btn btn-primary btn-lg"
            viewTransition
          >
            Start your shelf
          </NavLink>
          <NavLink to="/signin" className="btn btn-ghost btn-lg" viewTransition>
            Sign in
          </NavLink>
        </div>
      </div>

      {/* a manga page: one panel per thing the app does */}
      <ol className={styles.page} aria-label="What you can do">
        <li className={`${styles.panel} ${styles.panelWide}`}>
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
            <span className={styles.miniTabs}>
              <span className={styles.miniOn}>Reading 7</span>
              <span>Finished 12</span>
            </span>
          </div>
          <span className={`${styles.sfx} ${styles.sfxC}`} aria-hidden>
            Sorted!
          </span>
          <p className={styles.caption}>Search and sort your shelf</p>
        </li>
      </ol>
    </div>
  );
}
