// Someone's shelf, opened from the link they shared. Read-only: their name
// and the shelf in numbers (ShelfFacts), their favourites as a row of covers
// (or, without enough five-star series, what they have most of fanned out),
// then tabs: Reading, Finished, To read, and To get, the next volume they
// need for each series (ShelfTabs, ToGet). A search by name narrows every
// tab at once (their counts say where the matches are); a list can be put
// in order and shown as compact rows or covers. A series opens a sheet with the volumes they own
// (SeriesSheet). An open series is in the address (?series=), so a
// link can open straight to it. Someone without an account gets "Tap me"
// on the first series on their first visit (lib/shareVisits.ts), one quiet
// line offering to
// compare shelves, and the offer of a shelf of their own at the end. Only
// if they take up comparing do rows get "I have this"; the ones they mark
// become the start of their own shelf when they sign up
// (lib/sharePicks.ts). The page is its owner's, not a sign-up form. Its owner gets a line with the way to its settings
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
import { SearchIcon } from "../../components/icons/Icons";
import { getSharedShelf, type SharedShelf } from "../../lib/account";
import { readLocal, writeLocal } from "../../lib/prefs";
import { isPicked, readPicks, togglePick } from "../../lib/sharePicks";
import { countShareVisit } from "../../lib/shareVisits";
import { usePageMeta } from "../../lib/seo";
import { useAuth } from "../../store/auth";
import { useShelf } from "../../store/shelf";
import { settingsStyles } from "../Settings/styles";
import { onMyShelf } from "./compare";
import CompareNote from "./CompareNote";
import FollowBar from "./FollowBar";
import CoverRow from "./CoverRow";
import SeriesSheet from "./SeriesSheet";
import ShelfFacts from "./ShelfFacts";
import SavePicture from "./SavePicture";
import {
  favouritesOf,
  genreOf,
  genresOn,
  shelfNumbers,
  toGetOf,
} from "./shelfNumbers";
import ShelfTabs from "./ShelfTabs";
import ToGet from "./ToGet";
import { ownedCountOf, statusOf, TONES, type SharedManga } from "./shareParts";
import { shareStyles as styles } from "./styles";
import {
  SECTIONS,
  SORTS,
  plural,
  type Sort,
  type Tab,
  type View,
  VIEWS,
  viewNow,
} from "./sharedShelfView";
import { SeriesCard, SeriesRow } from "./SharedSeries";
import { CoverFan, ShareButtons } from "./SharedShelfHead";

// how many series a list shows at first, and adds with each "Show more"
const PAGE = 20;

// kept on the device once a visitor has opened a series on a shared shelf
const TAPPED_KEY = "shareTapped";
// "yes" while a visitor without an account is comparing shelves
const COMPARING_KEY = "shareComparing";

// what a shelf of their own does, for the invite at the end of the page
const INVITE_POINTS = [
  "Track what you own and read",
  "See what's coming out",
  "Find the cheapest copy",
  "Share it, like this one",
];

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
    // they've opened one: "Tap me" has done its job, here and on later visits
    if (m && !hasTapped) {
      setHasTapped(true);
      writeLocal(TAPPED_KEY, "yes");
    }
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
  // whether this visitor has ever opened a series on a shared shelf: until
  // they have, the first one says "Tap me"
  const [hasTapped, setHasTapped] = useState(
    () => readLocal(TAPPED_KEY) === "yes",
  );
  const [query, setQuery] = useState("");
  // what they have most of first: the part of a shelf worth showing off
  const [sort, setSort] = useState<Sort>("volumes");
  // one genre only ("" is all of them)
  const [genre, setGenre] = useState("");
  // how many of the open list are shown, and which list that count is for
  const [more, setMore] = useState({ key: "", count: PAGE });
  const [view, setView] = useState<View>(viewNow);
  const pickView = (next: View) => {
    setView(next);
    writeLocal("shareView", next);
  };
  // the tab they picked; until they pick, the first that has anything
  const [picked, setPicked] = useState<Tab | null>(null);
  const signedIn = useAuth((s) => s.isSignedIn);
  // the visitor's own shelf, to set this one beside (compare.ts)
  const myShelf = useShelf((s) => s.manga);
  const loadMyShelf = useShelf((s) => s.load);
  useEffect(() => {
    if (signedIn && !myShelf) void loadMyShelf();
  }, [signedIn, myShelf, loadMyShelf]);
  // only the series they don't have themselves
  const [onlyNew, setOnlyNew] = useState(false);
  // without an account: the series they've marked "I have this", and
  // whether they're comparing (rows only get the button once they've asked
  // to: a shelf is its owner's page, not a sign-up form). Their choice is
  // kept on the device, so "Not now" still holds after a refresh; the marks
  // themselves are kept either way
  const [picks, setPicks] = useState(readPicks);
  const [pickingOn, setPickingNow] = useState(
    () => readLocal(COMPARING_KEY) === "yes",
  );
  const setPickingOn = (on: boolean) => {
    setPickingNow(on);
    writeLocal(COMPARING_KEY, on ? "yes" : "no");
  };
  // the owner's picks for the top, once they've changed them on this visit
  const [topNow, setTopNow] = useState<string[] | null>(null);
  // a visitor without an account: which visit to a shared shelf this is.
  // Asked once the server has said they're signed out
  const [visit, setVisit] = useState<number | null>(null);
  // counted once, when the page has drawn for them (a repeat in the same
  // session counts as the same visit)
  if (signedIn === false && finished && shelf && visit === null)
    setVisit(countShareVisit());

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

  // beside the visitor's own shelf: for someone signed in, looking at a
  // shelf that isn't theirs
  const comparing = Boolean(signedIn && myShelf && shelf && !shelf.yours);
  const isMine = useMemo(() => onMyShelf(myShelf ?? []), [myShelf]);
  const hideMine = comparing && onlyNew;

  const groups = useMemo(() => {
    const words = query.trim().toLowerCase();
    const found = (shelf?.manga ?? [])
      .filter((m) => !words || m.name.toLowerCase().includes(words))
      .filter((m) => !genre || genreOf(m) === genre)
      .filter((m) => !hideMine || !isMine(m))
      .sort(SORTS[sort].order);
    return SECTIONS.map((name) => ({
      name,
      manga: found.filter((m) => statusOf(m) === name),
    }));
  }, [shelf, query, genre, sort, hideMine, isMine]);

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
  // their five-star series get a row of their own, in place of the fanned
  // covers, once there are a few
  // The row of covers at the top: the series its owner picked, in their
  // order; with none picked, their five-star ones once there are a few.
  // With neither, what they have most of is fanned out in the header
  const top = topNow ?? shelf.top ?? [];
  const topPicks = top.flatMap(
    (name) => all.find((m) => m.name === name) ?? [],
  );
  const favourites = favouritesOf(all);
  const hasFavourites = !topPicks.length && favourites.length >= 3;
  const hasFan =
    !topPicks.length &&
    !hasFavourites &&
    all.filter((m) => m.image).length >= 2;
  // the covers the page leads with, whichever row or fan that is: for the
  // picture its owner can save
  const leading = topPicks.length
    ? topPicks
    : hasFavourites
      ? favourites
      : [...all].sort((a, b) => ownedCountOf(b) - ownedCountOf(a));
  const { genres: shelfGenres } = shelfNumbers(all);
  // a visitor without an account who has asked to compare shelves
  const isPicking = signedIn === false && pickingOn && all.length > 0;
  // a visitor without an account gets the note about comparing: one spot
  // whose words follow what they've done (CompareNote.tsx)
  const offersCompare = signedIn === false && all.length > 0;
  // how many on this shelf a visitor without an account has marked
  const havePicked = all.filter((m) => isPicked(picks, m)).length;
  const compareNote = {
    isComparing: pickingOn,
    have: havePicked,
    // sign-up, then back here with those on their shelf and the two
    // shelves side by side
    signUpPath: `/signup?${new URLSearchParams({ next: `/u/${code}` })}`,
    onCompare: () => setPickingOn(true),
    onStop: () => setPickingOn(false),
  };
  // how this shelf sits beside the visitor's
  const shared = comparing ? all.filter(isMine).length : 0;
  // the next volume to get for each series: found by name and put in order
  // like the lists
  const words = query.trim().toLowerCase();
  const toGet = toGetOf(all)
    .filter((m) => !words || m.name.toLowerCase().includes(words))
    .filter((m) => !genre || genreOf(m) === genre)
    .filter((m) => !hideMine || !isMine(m))
    .sort(SORTS[sort].order);
  const genres = genresOn(all);
  // the tabs that have anything in them. A search narrows every tab, so
  // their counts say where the matches are
  const tabs: { name: Tab; count: number }[] = [
    ...shown.map((g) => ({ name: g.name, count: g.manga.length })),
    ...(toGet.length ? [{ name: "To get" as const, count: toGet.length }] : []),
  ];
  // the one they picked, or the first with anything in it (which is also
  // where a search lands when their tab has no match)
  const tab = tabs.find((t) => t.name === picked)?.name ?? tabs[0]?.name;
  // the open tab's series (none for "To get", which has its own list)
  const list = shown.find((g) => g.name === tab)?.manga ?? [];
  // A long list comes a page at a time, like the rest of the site. Any
  // change to what's listed starts again from the first page
  const listed = tab === "To get" ? toGet.length : list.length;
  const listKey = `${tab}|${query}|${genre}|${sort}|${hideMine}`;
  const showing = more.key === listKey ? more.count : PAGE;
  const firstCard = list[0];

  return (
    <article className={`${styles.page} fade-in`}>
      {/* its owner, looking at their own: where to change what's shared.
          First on the page, before anything a visitor sees */}
      {/* someone else's, to someone signed in: Follow */}
      {comparing && (
        <FollowBar
          key={code}
          code={code}
          name={shelf.displayName}
          following={Boolean(shelf.following)}
        />
      )}
      {shelf.yours && (
        <div className={styles.ownerNote}>
          <p>
            Others see this page, as <b>{shelf.displayName}</b>. Click on a
            series to add it to your top picks.
          </p>
          <p className={styles.ownerLinks}>
            <NavLink to="/settings/profile" viewTransition>
              Change name or what's shared
            </NavLink>
            <SavePicture
              picture={{
                name: shelf.displayName,
                tally: `${plural(all.length, "series", "series")} · ${plural(volumes, "volume")} owned`,
                genres: shelfGenres,
                // the row of covers the page leads with
                covers: leading.flatMap((m) => m.image ?? []),
              }}
            />
          </p>
        </div>
      )}

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
        {hasFan && <CoverFan manga={all} onOpen={setOpen} />}
        <ShareButtons besideCovers={hasFan} />
      </header>

      {topPicks.length > 0 && (
        <CoverRow
          title="Top picks"
          note={`Picked by ${shelf.displayName}`}
          manga={topPicks}
          onOpen={setOpen}
        />
      )}
      {hasFavourites && (
        <CoverRow
          title="Favourites"
          note="Their 5-star series"
          manga={favourites}
          stars
          onOpen={setOpen}
        />
      )}
      <ShelfFacts manga={all} />

      {/* signed in, on someone else's shelf: how it sits beside their own */}
      {comparing && (
        <div className={styles.compare}>
          <p>
            <b>You both have {plural(shared, "series", "series")}.</b>{" "}
            {all.length - shared} here aren't on your shelf.
          </p>
          <label className={styles.compareOnly}>
            <input
              type="checkbox"
              checked={onlyNew}
              onChange={(e) => setOnlyNew(e.target.checked)}
            />
            Show only ones I don't have
          </label>
        </div>
      )}

      {/* every list at a glance, with its count; one shows at a time */}
      {tab && (
        <ShelfTabs
          tabs={tabs}
          current={tab}
          onPick={setPicked}
          // a laptop: the offer to compare, at the right of the tabs
          aside={offersCompare && <CompareNote where="tabs" {...compareNote} />}
        />
      )}

      {/* under the tabs: the search, the order and the open list */}
      {/* held tall only once they've switched tabs, so a short list doesn't
          pull the stuck tabs back up; a short shelf on its own has no gap */}
      <div className={picked ? styles.lists : styles.listsShort}>
        {all.length > 0 && (
          <div className={styles.tools}>
            <label className={styles.search}>
              <SearchIcon />
              <span className="sr-only">
                Search {shelf.displayName}'s shelf
              </span>
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
              {/* one genre only: offered when the shelf has more than one */}
              {genres.length > 1 && (
                <div className={styles.genreMenu}>
                  <SortMenu
                    box
                    menuLabel="Genre"
                    options={[
                      { value: "", label: "All genres" },
                      ...genres.map((name) => ({ value: name, label: name })),
                    ]}
                    sortBy={genre}
                    onSort={setGenre}
                  />
                </div>
              )}
            </div>
            {/* compact rows or covers: beside the search on a phone, at the
                end of the line on a laptop */}
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
            {/* a phone: the offer to compare, tight under the controls */}
            {offersCompare && <CompareNote where="tools" {...compareNote} />}
          </div>
        )}

        {all.length === 0 && (
          <p className={styles.nothing}>Nothing on this shelf yet.</p>
        )}
        {all.length > 0 && !tab && (
          <p className={styles.nothing}>
            {query.trim()
              ? `No series here match “${query.trim()}”.`
              : `Nothing in ${genre} here.`}
          </p>
        )}
        {tab === "To get" && (
          <ToGet manga={toGet.slice(0, showing)} owner={shelf.displayName} />
        )}
        {tab && tab !== "To get" && (
          <ul
            className={view === "rows" ? styles.rows : styles.grid}
            style={{ "--tone": TONES[tab] } as React.CSSProperties}
          >
            {list.slice(0, showing).map((m, j) => {
              const Item = view === "rows" ? SeriesRow : SeriesCard;
              return (
                <Item
                  key={`${m.name}-${j}`}
                  m={m}
                  pointHere={visit === 1 && !hasTapped && m === firstCard}
                  isTopPick={top.includes(m.name)}
                  mine={comparing ? (isMine(m) ? "have" : "dont") : undefined}
                  onAdded={loadMyShelf}
                  pick={
                    isPicking
                      ? {
                          picked: isPicked(picks, m),
                          onToggle: () => setPicks(togglePick(m)),
                        }
                      : undefined
                  }
                  onOpen={() => setOpen(m)}
                />
              );
            })}
          </ul>
        )}
        {/* the rest of a long list, a page more at a time */}
        {listed > showing && (
          <p className={styles.showMore}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setMore({ key: listKey, count: showing + PAGE })}
            >
              Show {Math.min(PAGE, listed - showing)} more
            </button>
            <span>
              {showing} of {listed}
            </span>
          </p>
        )}
      </div>

      {signedIn === false && (
        <aside className={styles.invite} aria-labelledby="share-invite">
          <div className={styles.inviteText}>
            <h2 id="share-invite" className={styles.inviteHead}>
              Make a shelf of your own
            </h2>
            {/* one thing a line: as a sentence it was a run-on */}
            <ul className={styles.inviteList}>
              {INVITE_POINTS.map((point) => (
                <li key={point}>{point}</li>
              ))}
            </ul>
            <p className={styles.inviteGo}>
              <NavLink to="/signup" className="btn btn-primary" viewTransition>
                Start my shelf
              </NavLink>
              <span className={styles.inviteFree}>It's free</span>
            </p>
          </div>
          {/* Kenji, standing in the corner where the print dots gather */}
          <span className={`printed ${styles.inviteArt}`} aria-hidden>
            <Mascot mood="happy" />
          </span>
        </aside>
      )}

      {open && (
        <SeriesSheet
          m={open}
          owner={shelf.displayName}
          topPick={shelf.yours ? { top, onChange: setTopNow } : undefined}
          pick={
            isPicking
              ? {
                  picked: isPicked(picks, open),
                  onToggle: () => setPicks(togglePick(open)),
                }
              : undefined
          }
          onClose={() => setOpen(null)}
        />
      )}
    </article>
  );
}
