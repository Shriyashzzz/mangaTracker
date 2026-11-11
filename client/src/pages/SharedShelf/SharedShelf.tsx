// Someone's shelf, opened from the link they shared. Read-only: their name and
// the shelf in numbers with what they have most of fanned out beside, the series in Reading / Finished / To read (found by
// name, put in order, as compact rows or covers), and a sheet with the volumes they own when one is
// tapped (SeriesSheet). An open series is in the address (?series=), so a
// link can open straight to it. Someone without an account gets Kenji on their first
// three visits (SharePeek) and a way to start their own at the end
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
import StarRating from "../../components/starRating/StarRating";
import {
  CheckIcon,
  ChevronDownIcon,
  LinkIcon,
  SearchIcon,
  ShareIcon,
} from "../../components/icons/Icons";
import { getSharedShelf, type SharedShelf } from "../../lib/account";
import { readLocal, writeLocal } from "../../lib/prefs";
import { countShareVisit, sharePeekFor } from "../../lib/sharePeek";
import { usePageMeta } from "../../lib/seo";
import { useAuth } from "../../store/auth";
import { settingsStyles } from "../Settings/styles";
import SeriesSheet, { Cover } from "./SeriesSheet";
import {
  ownedCountOf,
  ownedVolumesOf,
  shelfOf,
  statusOf,
  TONES,
  volumeRanges,
  type SharedManga,
} from "./shareParts";
import SharePeek from "./SharePeek";
import { shareStyles as styles } from "./styles";

const SECTIONS = ["Reading", "Finished", "To read"] as const;

const SORTS = {
  name: {
    label: "A–Z",
    order: (a: SharedManga, b: SharedManga) => a.name.localeCompare(b.name),
  },
  rating: {
    label: "Rating",
    order: (a: SharedManga, b: SharedManga) =>
      (b.rating ?? 0) - (a.rating ?? 0) || a.name.localeCompare(b.name),
  },
  volumes: {
    label: "Most volumes",
    order: (a: SharedManga, b: SharedManga) =>
      ownedCountOf(b) - ownedCountOf(a) || a.name.localeCompare(b.name),
  },
} as const;
type Sort = keyof typeof SORTS;

// compact rows unless this visitor picked covers; kept on their device, apart
// from how their own shelf is laid out
type View = "rows" | "covers";
const VIEWS: Record<View, string> = { rows: "Compact", covers: "Covers" };
const viewNow = (): View =>
  readLocal("shareView") === "covers" ? "covers" : "rows";

// on phones only the first list starts open, so the others are a tap away
// rather than a long scroll
const narrow = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(max-width: 720px)").matches;

const plural = (n: number, one: string, many = `${one}s`) =>
  `${n} ${n === 1 ? one : many}`;

function SeriesCard({
  m,
  pointHere,
  onOpen,
}: {
  m: SharedManga;
  pointHere: boolean;
  onOpen: () => void;
}) {
  const owned = ownedVolumesOf(m);
  return (
    <li>
      <button
        type="button"
        className={styles.card}
        aria-haspopup="dialog"
        aria-label={`${m.name}: ${owned.length ? `owns ${plural(owned.length, "volume")}` : "no volumes yet"}. Open`}
        onClick={onOpen}
      >
        <Cover m={m} className={styles.cover}>
          {m.status && <span className={styles.stamp}>Done</span>}
          {pointHere && (
            <span className={styles.tapMe} aria-hidden>
              Tap me
            </span>
          )}
        </Cover>
        <span className={styles.cardName}>{m.name}</span>
        <span className={styles.cardMeta}>
          {owned.length ? (
            <span className={styles.cardVols}>Vol. {volumeRanges(owned)}</span>
          ) : (
            "No volumes yet"
          )}
          {!m.status && m.bookmark != null && ` · ch. ${m.bookmark}`}
          {m.lightNovel && " · novel"}
        </span>
        {m.rating ? <StarRating value={m.rating} size="sm" /> : null}
      </button>
    </li>
  );
}

// the same series as a compact row: what they own comes first
function SeriesRow({
  m,
  pointHere,
  onOpen,
}: {
  m: SharedManga;
  pointHere: boolean;
  onOpen: () => void;
}) {
  const owned = ownedVolumesOf(m);
  const more = [
    !m.status && m.bookmark != null && `ch. ${m.bookmark}`,
    m.lightNovel && "light novel",
  ].filter(Boolean);
  return (
    <li className={styles.row}>
      <button
        type="button"
        className={styles.rowCard}
        aria-haspopup="dialog"
        aria-label={`${m.name}: ${owned.length ? `owns ${plural(owned.length, "volume")}` : "no volumes yet"}. Open`}
        onClick={onOpen}
      >
        <Cover m={m} className={styles.rowCover} />
        <span className={styles.rowText}>
          <span className={styles.rowName}>{m.name}</span>
          <span className={styles.cardMeta}>
            {owned.length ? (
              <span className={styles.cardVols}>
                Vol. {volumeRanges(owned)}
              </span>
            ) : (
              "No volumes yet"
            )}
          </span>
          <VolumeTicks owned={owned} />
          {/* one line for the rest, so every row is the same height */}
          <span className={styles.rowMore}>
            {more.length > 0 && <span>{more.join(" · ")}</span>}
            {m.rating ? <StarRating value={m.rating} size="sm" /> : null}
          </span>
        </span>
        {pointHere && (
          <span className={styles.rowTapMe} aria-hidden>
            Tap me
          </span>
        )}
      </button>
    </li>
  );
}

// the volumes they own as a strip of ticks, 1 to the furthest: a gap shows
// as an empty tick, so "1–3, 5, 8–10" can be seen at a glance
// as many ticks as the row has room for; past that, each tick stands for a run
// of volumes and is a gap if any of them is missing (the ranges say which)
const MAX_TICKS = 40;

function VolumeTicks({ owned }: { owned: number[] }) {
  if (!owned.length) return null;
  const shelf = shelfOf(owned);
  const per = Math.ceil(shelf.length / MAX_TICKS);
  const ticks = Array.from({ length: Math.ceil(shelf.length / per) }, (_, i) =>
    shelf.slice(i * per, (i + 1) * per).every((s) => s.mine),
  );
  return (
    <span className={styles.ticks} aria-hidden>
      {ticks.map((mine, i) => (
        <span key={i} className={mine ? styles.tick : styles.tickGap} />
      ))}
    </span>
  );
}

// what they have most of, fanned out like books on a table. Each opens its
// sheet; most of the shelf in one look before any scrolling
function CoverFan({
  manga,
  onOpen,
}: {
  manga: SharedManga[];
  onOpen: (m: SharedManga) => void;
}) {
  const top = [...manga]
    .sort(
      (a, b) =>
        ownedCountOf(b) - ownedCountOf(a) || (b.rating ?? 0) - (a.rating ?? 0),
    )
    .slice(0, 5);
  if (top.length < 2) return null;
  return (
    <ul className={styles.fan} aria-label="What they have most of">
      {top.map((m, i) => (
        <li
          key={`${m.name}-${i}`}
          className={styles.fanItem}
          style={
            {
              "--tilt": `${(i - (top.length - 1) / 2) * 4}deg`,
            } as React.CSSProperties
          }
        >
          <button
            type="button"
            className={styles.fanCard}
            aria-haspopup="dialog"
            aria-label={`${m.name}. Open`}
            onClick={() => onOpen(m)}
          >
            <Cover m={m} className={styles.fanCover} />
          </button>
        </li>
      ))}
    </ul>
  );
}

// copy the link; on phones, the share sheet too
function ShareButtons() {
  const [copied, setCopied] = useState(false);
  const url = typeof window !== "undefined" ? window.location.href : "";
  const canShare = typeof navigator !== "undefined" && "share" in navigator;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // no clipboard (an old browser, or blocked): the address bar has it
    }
  };
  return (
    <div className={styles.actions}>
      <button type="button" className={styles.action} onClick={copy}>
        {copied ? <CheckIcon /> : <LinkIcon />}
        <span aria-live="polite">{copied ? "Copied" : "Copy link"}</span>
      </button>
      {canShare && (
        <button
          type="button"
          className={styles.action}
          onClick={() => navigator.share({ url }).catch(() => {})}
        >
          <ShareIcon />
          Share
        </button>
      )}
    </div>
  );
}

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
            <label className={styles.sortMenu}>
              <span className="sr-only">Order</span>
              <select
                className={styles.sortSelect}
                value={sort}
                onChange={(e) => setSort(e.target.value as Sort)}
              >
                {(Object.keys(SORTS) as Sort[]).map((key) => (
                  <option key={key} value={key}>
                    {SORTS[key].label}
                  </option>
                ))}
              </select>
            </label>
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
