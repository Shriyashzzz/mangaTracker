// Someone's shelf, opened from the link they shared. Read-only: their name and
// the shelf in numbers with what they have most of fanned out beside, the series in Reading / Finished / To read (found by
// name, put in order, as compact rows or covers), and a sheet with the volumes they own when one is
// tapped (SeriesSheet). An open series is in the address (?series=), so a
// link can open straight to it. Someone without an account gets Kenji on their first
// three visits (SharePeek) and a way to start their own at the end
import { SortMenu } from "../Home/ShelfBar";
import { useEffect, useMemo, useState } from "react";
import {
  NavLink,
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router";
import Avatar from "../../components/avatar/Avatar";
import Mascot from "../../components/mascot/Mascot";
import { ChevronDownIcon, SearchIcon } from "../../components/icons/Icons";
import { getSharedShelf, type SharedShelf } from "../../lib/account";
import { writeLocal } from "../../lib/prefs";
import { countShareVisit, sharePeekFor } from "../../lib/sharePeek";
import { usePageMeta } from "../../lib/seo";
import { useAuth } from "../../store/auth";
import { settingsStyles } from "../Settings/styles";
import SeriesSheet from "./SeriesSheet";
import { ownedCountOf, statusOf, TONES, type SharedManga } from "./shareParts";
import SharePeek from "./SharePeek";
import { shareStyles as styles } from "./styles";
import {
  SECTIONS,
  SORTS,
  type Sort,
  type View,
  VIEWS,
  viewNow,
  narrow,
} from "./sharedShelfView";
import { SeriesCard, SeriesRow } from "./SharedSeries";
import { CoverFan, ShareButtons } from "./SharedShelfHead";

export default function SharedShelfPage() {
  const code = useParams().code!;
  const [state, setState] = useState<{
    code: string;
    shelf: SharedShelf | null;
  } | null>(null);
  const shelf = state?.code === code ? state.shelf : null;
  const finished = state?.code === code;
  // the open series lives in the address, so its link opens it
  const [params, setParams] = useSearchParams();
  const openName = params.get("series")?.toLowerCase();
  const open =
    (openName && shelf?.manga.find((m) => m.name.toLowerCase() === openName)) ||
    null;
  // opening is a step in the history, so Back (or a swipe) closes it again;
  // closing one that was opened here steps back, rather than adding another
  const location = useLocation();
  const navigate = useNavigate();
  const setOpen = (m: SharedManga | null) => {
    if (!m && (location.state as { sheet?: boolean } | null)?.sheet) {
      navigate(-1);
      return;
    }
    setParams(
      (now) => {
        const next = new URLSearchParams(now);
        if (m) next.set("series", m.name);
        else next.delete("series");
        return next;
      },
      {
        replace: !m,
        preventScrollReset: true,
        state: m ? { sheet: true } : null,
      },
    );
  };
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort>("name");
  const [view, setView] = useState<View>(viewNow);
  const pickView = (next: View) => {
    setView(next);
    writeLocal("shareView", next);
  };
  const [startOpen] = useState(() => !narrow());
  const signedIn = useAuth((s) => s.isSignedIn);
  // a visitor without an account: which of Kenji's three notes, if any. Asked
  // once the server has said they're signed out
  const [visit, setVisit] = useState<number | null>(null);
  // counted once, when the page has drawn for them (a repeat in the same
  // session counts as the same visit)
  if (signedIn === false && finished && shelf && visit === null)
    setVisit(countShareVisit());
  const peek = visit === null ? null : sharePeekFor(visit);

  usePageMeta({
    title: shelf
      ? open
        ? `${open.name} on ${shelf.displayName}'s shelf`
        : `${shelf.displayName}'s manga shelf`
      : "A shared shelf",
    noindex: true,
  });

  useEffect(() => {
    const controller = new AbortController();
    getSharedShelf(code, controller.signal)
      .then((found) => setState({ code, shelf: found }))
      .catch((e: Error) => {
        if (e.name !== "AbortError") setState({ code, shelf: null });
      });
    return () => controller.abort();
  }, [code]);

  const groups = useMemo(() => {
    const words = query.trim().toLowerCase();
    const found = (shelf?.manga ?? [])
      .filter((m) => !words || m.name.toLowerCase().includes(words))
      .sort(SORTS[sort].order);
    return SECTIONS.map((name) => ({
      name,
      manga: found.filter((m) => statusOf(m) === name),
    }));
  }, [shelf, query, sort]);

  if (!finished) {
    return (
      <div
        className={`skeleton ${styles.page} min-h-96`}
        aria-busy="true"
        aria-label="Loading"
      />
    );
  }

  if (!shelf) {
    return (
      <div className="fade-in mx-auto my-12 flex max-w-[440px] flex-col items-center gap-3 text-center">
        <span className="printed mascot-spot" aria-hidden>
          <Mascot mood="confused" />
        </span>
        <h1 className={settingsStyles.heading}>This shelf isn't shared</h1>
        <p className={settingsStyles.body}>
          The link might be wrong, or its owner may have made their list
          private.
        </p>
        <NavLink to="/" className="btn btn-secondary" viewTransition>
          Go to Manga Tracker
        </NavLink>
      </div>
    );
  }

  const all = shelf.manga;
  const volumes = all.reduce((n, m) => n + ownedCountOf(m), 0);
  const shown = groups.filter((g) => g.manga.length);
  const firstCard = shown[0]?.manga[0];

  return (
    <article className={`${styles.page} fade-in`}>
      <header className={styles.head}>
        <div className={styles.who}>
          <Avatar id={shelf.avatar} className={styles.art} />
          <div className="min-w-0">
            <h1 className={styles.name}>{shelf.displayName}</h1>
            <p className={styles.tally}>
              {(
                [
                  [all.length, "series", "var(--ink)"],
                  [
                    volumes,
                    volumes === 1 ? "volume owned" : "volumes owned",
                    "var(--accent)",
                  ],
                ] as const
              ).map(([n, label, ink]) => (
                <span
                  key={label}
                  className={styles.tallyItem}
                  style={{ "--dot": ink } as React.CSSProperties}
                >
                  <b>{n}</b> {label}
                </span>
              ))}
            </p>
          </div>
        </div>
        <CoverFan manga={all} onOpen={setOpen} />
        <ShareButtons />
      </header>

      {all.length > 0 && (
        <div className={styles.tools}>
          <label className={styles.search}>
            <SearchIcon />
            <span className="sr-only">Search {shelf.displayName}'s shelf</span>
            <input
              type="search"
              className={styles.searchInput}
              placeholder={`Search ${shelf.displayName}'s shelf`}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          <div className={styles.controls}>
            <div className={styles.sorts} role="group" aria-label="Order">
              {(Object.keys(SORTS) as Sort[]).map((key) => (
                <button
                  key={key}
                  type="button"
                  className={sort === key ? styles.sortOn : styles.sort}
                  aria-pressed={sort === key}
                  onClick={() => setSort(key)}
                >
                  {SORTS[key].label}
                </button>
              ))}
            </div>
            {/* on phones the order is a menu, so it shares a line with the layout */}
            <div className={styles.sortMenu}>
              <SortMenu
                box
                menuLabel="Order"
                options={(Object.keys(SORTS) as Sort[]).map((key) => ({
                  value: key,
                  label: SORTS[key].label,
                }))}
                sortBy={sort}
                onSort={setSort}
              />
            </div>
            <div className={styles.views} role="group" aria-label="Layout">
              {(Object.keys(VIEWS) as View[]).map((key) => (
                <button
                  key={key}
                  type="button"
                  className={view === key ? styles.viewOn : styles.view}
                  aria-pressed={view === key}
                  onClick={() => pickView(key)}
                >
                  {VIEWS[key]}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {all.length === 0 ? (
        <p className={styles.nothing}>Nothing on this shelf yet.</p>
      ) : shown.length === 0 ? (
        <p className={styles.nothing}>No series here match “{query.trim()}”.</p>
      ) : (
        shown.map((group, i) => (
          <details
            key={group.name}
            className={styles.section}
            style={{ "--tone": TONES[group.name] } as React.CSSProperties}
            // searching opens every list with something found
            open={startOpen || i === 0 || Boolean(query.trim())}
          >
            <summary className={styles.sectionHead}>
              <h2 className={styles.sectionName}>{group.name}</h2>
              <span className={styles.sectionCount}>{group.manga.length}</span>
              <ChevronDownIcon className={styles.sectionFold} />
            </summary>
            <ul className={view === "rows" ? styles.rows : styles.grid}>
              {group.manga.map((m, j) => {
                const Item = view === "rows" ? SeriesRow : SeriesCard;
                return (
                  <Item
                    key={`${m.name}-${j}`}
                    m={m}
                    pointHere={peek === 1 && m === firstCard}
                    onOpen={() => setOpen(m)}
                  />
                );
              })}
            </ul>
          </details>
        ))
      )}

      {signedIn === false && (
        <aside className={styles.invite} aria-labelledby="share-invite">
          <span className={`printed ${styles.inviteArt}`} aria-hidden>
            <Mascot mood="happy" />
          </span>
          <div className={styles.inviteText}>
            <h2 id="share-invite" className={styles.inviteHead}>
              Make a shelf of your own
            </h2>
            <p className={styles.inviteBody}>
              Keep track of what you own and what you're reading, see what's
              coming out, find the cheapest copy, and share it like this one.
              It's free.
            </p>
          </div>
          <NavLink to="/signup" className="btn btn-primary" viewTransition>
            Start my shelf
          </NavLink>
        </aside>
      )}

      {open && (
        <SeriesSheet
          m={open}
          owner={shelf.displayName}
          onClose={() => setOpen(null)}
        />
      )}
      {peek && <SharePeek visit={peek} owner={shelf.displayName} />}
    </article>
  );
}
