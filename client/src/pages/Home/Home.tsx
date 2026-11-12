// The shelf: every series they track, as a page of covers (or compact rows),
// with tabs for what they're reading, have finished, want to read, own, and
// what's newly out (New). The parts live beside it:
//
//   shelfViews.ts        what a view shows and says (pure, tested)
//   useShelfTab.ts       which tab is open, in step with the address
//   useSelectMode.ts     Select: move or delete several, with undo
//   useHideActions.ts    the New tab's Hide, Hide all, Unhide all, with undo
//   useShelfShortcuts.ts / and n
//   SelectDock.tsx, NewTabParts.tsx, AddButton.tsx: what those draw
import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { NavLink, useNavigate, useSearchParams } from "react-router";
import MangaCard from "../../components/mangaCard/MangaCard";
import { BarcodeIcon, CheckIcon } from "../../components/icons/Icons";
import RangePager from "../../components/rangePager/RangePager";
import Mascot from "../../components/mascot/Mascot";
import { EmptyShelfUndo } from "../../components/deletedNote/DeletedNote";
import ReleaseTip from "../../components/whatsNew/ReleaseTip";
import ViewPeek from "../../components/viewPeek/ViewPeek";
import { usePrivatePage } from "../../lib/seo";
import { volumePath } from "../../lib/prices";
import {
  readLocal,
  savePrefs,
  shelfViewNow,
  writeLocal,
} from "../../lib/prefs";
import {
  CHECKED_BEFORE_KEY,
  LAST_NEW_COUNT_KEY,
  SORT_OPTIONS,
} from "../../lib/shelf";
import { shownNewCount } from "../../lib/releaseMath";
import { isDemo } from "../../lib/demo";
import { fillCovers } from "../../lib/coverFill";
import { useAuth } from "../../store/auth";
import { useShelf } from "../../store/shelf";
import ShelfBar from "./ShelfBar";
import VolumesView from "./VolumesView";
import ReleaseModal from "./ReleaseModal";
import DeleteManyModal from "./DeleteManyModal";
import SelectDock, { MovedNote } from "./SelectDock";
import {
  CheckBar,
  HiddenNote,
  NothingNew,
  ReleaseLinks,
  ReleaseTools,
} from "./NewTabParts";
import UpcomingReleases from "./UpcomingReleases";
import type { Manga } from "../../lib/types";
import { hasBottomBar } from "../../lib/bottomBar";
import { checkedAgo } from "../../lib/releaseCache";
import { NewPiles, PileHead, type CoverLink } from "./NewPiles";
import {
  isPileView,
  PILES_FROM,
  catchUpText,
  sortIntoPiles,
  sortPile,
  type Pile,
  type PileSort,
  type PileView,
} from "./piles";
import AddButton from "./AddButton";
import AddChoice from "../../components/scanSheet/AddChoice";
// the camera and its barcode library load only when someone scans
const ScanSheet = lazy(() => import("../../components/scanSheet/ScanSheet"));
import LibrarySkeleton from "./LibrarySkeleton";
import GuestHero from "./GuestHero";
import {
  BIG_SHELF,
  EARLY_CHECKS,
  filterShelf,
  isGrouped,
  isHiddenAs,
  newsFor,
  readSession,
  readSpot,
  RELEASE_KINDS,
  SEEN_KIND,
  SHELF_PAGE_SIZE,
  SHELF_SPOT_KEY,
  shelfCounts,
  writeSession,
  type ReleaseKind,
} from "./shelfViews";
import { useShelfTab } from "./useShelfTab";
import { useSelectMode } from "./useSelectMode";
import { useHideActions } from "./useHideActions";
import { useShelfShortcuts } from "./useShelfShortcuts";
import { homeStyles as styles } from "./styles";

export default function Home() {
  usePrivatePage("Your shelf");
  const isSignedIn = useAuth((s) => s.isSignedIn);

  if (isSignedIn === null) {
    return <LibrarySkeleton />;
  }
  return isSignedIn ? <Library /> : <GuestHero />;
}

function Library() {
  const mangaData = useShelf((s) => s.manga);
  const loadError = useShelf((s) => s.loadFailed);
  const releases = useShelf((s) => s.releases);
  const outcomes = useShelf((s) => s.outcomes);
  const checkedAt = useShelf((s) => s.checkedAt);
  const loadShelf = useShelf((s) => s.load);
  const checkReleases = useShelf((s) => s.checkReleases);
  const recheckReleases = useShelf((s) => s.recheckReleases);
  // the "Deleted · Undo" note sits where the bar does: the bar goes above it
  const undoShowing = useShelf((s) => Boolean(s.lastDeleted?.length));
  const navigator = useNavigate();
  const [spot] = useState(readSpot);
  const [query, setQuery] = useState(spot?.query ?? "");
  const { tab, pickTab, wantHidden, checksOn } = useShelfTab();
  const [sortBy, setSortBy] = useState(() => {
    const saved = readSession("librarySort", readLocal("shelfSort") ?? "");
    return SORT_OPTIONS.some((o) => o.value === saved) ? saved : "";
  });
  const [releaseKind, setReleaseKind] = useState<ReleaseKind>(() => {
    const saved = readSession("libraryReleaseKind", "volumes");
    return saved in RELEASE_KINDS ? (saved as ReleaseKind) : "volumes";
  });
  // the series whose grouped list is open
  const [openRelease, setOpenRelease] = useState<number | null>(null);
  // set in settings; Kenji's compact-rows offer (ViewPeek) can change it
  // while they're here
  const [rowsChosen, setRowsChosen] = useState(() => shelfViewNow() === "rows");
  const hiddenCount = (mangaData ?? []).filter((m) =>
    isHiddenAs(releases[m.id], releaseKind),
  ).length;
  // showing the last one again leaves nothing here, so it goes back to what's new
  const viewingHidden = tab === "new" && wantHidden && hiddenCount > 0;
  const showingNew = tab === "new";
  // on a big New tab, one pile's own page (piles.ts), or everything at once
  const [searchParams, setSearchParams] = useSearchParams();
  const pileParam = searchParams.get("pile");
  const pileView = showingNew && isPileView(pileParam) ? pileParam : null;
  // a pile's own page, in the order they pick (kept between piles)
  const [pileSort, setPileSort] = useState<PileSort>("");

  // the shelf shows one block of manga at a time; any change to the tab,
  // search or sort starts again from the first block
  const filterKey = `${tab}|${releaseKind}|${viewingHidden}|${pileView}|${pileSort}|${sortBy}|${query.trim().toLowerCase()}`;
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
  const hasManga = Boolean(mangaData?.length);
  useEffect(() => {
    if (!spot || !hasManga) return;
    try {
      sessionStorage.removeItem(SHELF_SPOT_KEY);
    } catch {
      /* ignore */
    }
    const frame = requestAnimationFrame(() => window.scrollTo(0, spot.y));
    return () => cancelAnimationFrame(frame);
  }, [spot, hasManga]);

  // covers for series that came in without one, looked up in the background
  // once per visit (lib/coverFill.ts); each shows as soon as it's found
  useEffect(() => {
    if (!hasManga || isDemo()) return;
    const controller = new AbortController();
    void fillCovers(
      useShelf.getState().manga ?? [],
      controller.signal,
      (id, cover) =>
        useShelf.setState((state) => ({
          manga:
            state.manga?.map((m) =>
              m.id === id ? { ...m, image: cover } : m,
            ) ?? null,
        })),
    );
    return () => controller.abort();
  }, [hasManga]);

  // what's new for each manga. Only asked for once the New tab is opened, or for
  // anyone on rows, whose progress needs the latest chapter. After that it carries
  // on even if they leave, and new titles get picked up
  useEffect(() => {
    if (checksOn && (showingNew || rowsChosen) && mangaData?.length)
      checkReleases();
  }, [mangaData, releases, showingNew, rowsChosen, checksOn, checkReleases]);
  const checked = (mangaData ?? []).filter((m) => m.id in releases).length;
  const checking = showingNew && checked < (mangaData?.length ?? 0);
  const allChecked = checked > 0 && checked >= (mangaData?.length ?? 0);
  // how old the oldest answer on show is, said quietly under the list
  const oldestCheck = useMemo(
    () =>
      Math.min(
        ...(mangaData ?? []).map((m) => checkedAt[m.id] ?? Infinity),
        Infinity,
      ),
    [mangaData, checkedAt],
  );
  const [checkedBefore] = useState(
    () => readLocal(CHECKED_BEFORE_KEY) !== null,
  );
  const [lastNewCount] = useState(() => {
    const saved = readLocal(LAST_NEW_COUNT_KEY);
    return saved ? Number(saved) : null;
  });

  const counts = useMemo(
    () => shelfCounts(mangaData ?? [], releases),
    [mangaData, releases],
  );

  // nothing left hidden, so there's no list to be on. Opened straight onto it,
  // the check has to finish first to know what's hidden; once it's been shown,
  // emptying it leaves at once. Otherwise ?view=hidden stays, and the next card
  // hidden brings the list back holding just that one
  const [sawHidden, setSawHidden] = useState(false);
  if (viewingHidden && !sawHidden) setSawHidden(true);
  if (!wantHidden && sawHidden) setSawHidden(false);
  const leaveHidden =
    wantHidden && hiddenCount === 0 && (allChecked || sawHidden);
  useEffect(() => {
    if (leaveHidden) navigator("/shelf", { replace: true });
  }, [leaveHidden, navigator]);

  useEffect(() => {
    if (!allChecked) return;
    writeLocal(CHECKED_BEFORE_KEY, "yes");
    writeLocal(LAST_NEW_COUNT_KEY, String(counts.new));
  }, [allChecked, counts.new]);

  const listed = useMemo(
    () =>
      filterShelf(mangaData ?? [], releases, {
        tab,
        releaseKind,
        viewingHidden,
        query,
        sortBy,
      }),
    [mangaData, releases, releaseKind, viewingHidden, tab, sortBy, query],
  );
  const piles = useMemo(
    () => sortIntoPiles(showingNew ? listed : [], releases, releaseKind),
    [showingNew, listed, releases, releaseKind],
  );
  const visibleManga = pileView
    ? sortPile(
        pileView === "all" ? listed : piles[pileView],
        releases,
        releaseKind,
        pileSort,
      )
    : listed;
  // a big list of what's new, not searched: sorted into piles instead
  const showPiles =
    showingNew && !pileView && !query.trim() && listed.length >= PILES_FROM;
  // opening a pile is a step of its own, so Back returns to the piles
  // the pile they came back from, whose See all takes the focus again
  const [pileLeft, setPileLeft] = useState<Pile | null>(null);
  const openPile = (view: PileView | null) => {
    setPileLeft(!view && pileView && pileView !== "all" ? pileView : null);
    const next = new URLSearchParams(searchParams);
    if (view) next.set("pile", view);
    else next.delete("pile");
    // from the piles, up to the top of the pile's page (the router's own
    // reset); between piles (the chips) the page stays where it is
    setSearchParams(next, { preventScrollReset: Boolean(pileView && view) });
  };
  // a pile hidden down to nothing: back to the piles
  const pileEmptied =
    allChecked &&
    pileView !== null &&
    pileView !== "all" &&
    !query.trim() &&
    piles[pileView].length === 0;
  useEffect(() => {
    if (!pileEmptied) return;
    const next = new URLSearchParams(searchParams);
    next.delete("pile");
    setSearchParams(next, { replace: true });
  }, [pileEmptied, searchParams, setSearchParams]);
  // a pile's page on a phone grows by "Show 20 more" instead of turning
  // pages: one fewer row of controls on a small screen
  const growing = Boolean(pileView) && hasBottomBar();
  const shelfPage = visibleManga.slice(
    growing ? 0 : pageIndex * SHELF_PAGE_SIZE,
    (pageIndex + 1) * SHELF_PAGE_SIZE,
  );

  const { select, moveMenu, movedNote } = useSelectMode({
    canSelect: !showingNew && tab !== "volumes" && hasManga,
    shown: visibleManga,
  });
  const hideActions = useHideActions({
    releases,
    releaseKind,
    viewingHidden,
    shown: visibleManga,
    closeRelease: () => setOpenRelease(null),
  });
  useShelfShortcuts(select.selectOn);

  const goToAdd = () => navigator("/add", { viewTransition: true });
  // the phones' round +: type a title or scan barcodes (AddChoice)
  const [adding, setAdding] = useState<null | "choosing" | "scanning">(null);

  // the bottom pager takes them up to where the new page starts; the top
  // one is already there, so the page stays still under it
  const changePage = (index: number, scrollUp: boolean) => {
    setPage({ key: filterKey, index });
    if (scrollUp)
      document
        .getElementById("shelf-grid")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
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
        {/* a stack of volumes by the hand: the shelf's own Scan button and
            the phone's + aren't here yet, so it's offered from the start */}
        <button
          type="button"
          className={`${styles.importLink} mx-auto mt-2 block w-fit`}
          onClick={() => setAdding("scanning")}
          onPointerEnter={() =>
            void import("../../components/scanSheet/ScanSheet")
          }
        >
          Or scan their barcodes
        </button>
        {adding === "scanning" && (
          <Suspense fallback={null}>
            <ScanSheet onClose={() => setAdding(null)} />
          </Suspense>
        )}
      </div>
    );
  }

  // what this view of the New tab can say anything about: light novels have
  // volumes in English, but no chapters or Japanese volumes to follow
  const looked = mangaData.filter(
    (m) => releaseKind === "volumes" || !m.lightNovel,
  );
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
            count: shownNewCount(mangaData, releases, outcomes, lastNewCount),
          },
        ]
      : []),
  ];
  const grouped = (id: number) => isGrouped(releases[id], releaseKind);
  // the next volume leads straight to its prices; there's nothing to do with it
  // but buy it. No catalog entry to go on: the details page, as usual
  const buyLinkFor = (id: number) => {
    const book = releases[id]?.nextVolumeBook;
    return showingNew && releaseKind === "volumes" && book && !grouped(id)
      ? volumePath(book.isbn13, book.title)
      : undefined;
  };
  const openManga = mangaData.find((m) => m.id === openRelease);

  const total = mangaData.length;
  // a series with no saved place can't be called caught up, so it never shows
  // here. An empty tab has to say so, or it reads as "nothing's out"
  const unknownPlace = looked.filter((m) =>
    releaseKind === "chapters"
      ? !m.bookmark
      : !m.volumesOwned && !releases[m.id]?.currentVolume,
  ).length;
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
  const progress = <CheckBar checked={checked} total={total} />;
  const bigShelfNote =
    bigFirstCheck && "The first check on a big shelf can take a few minutes.";

  const pileExtra = (p: Pile) =>
    catchUpText(p, piles[p], releases, releaseKind);
  // a card on New opens its details at the part about this kind of release
  const newDetailsSearch =
    releaseKind === "japan"
      ? "?edition=japan"
      : releaseKind === "chapters"
        ? "?new=chapter"
        : undefined;
  // a pile's cover goes where its card would, stamped with which one
  const coverLink = (m: Manga): CoverLink => {
    const found = releases[m.id];
    return {
      to: buyLinkFor(m.id) ?? `/details/${m.id}${newDetailsSearch ?? ""}`,
      onOpen:
        !viewingHidden && grouped(m.id)
          ? () => setOpenRelease(m.id)
          : undefined,
      stamp:
        releaseKind === "chapters"
          ? `Ch. ${found?.nextChapter ?? found?.latestChapter ?? ""}`
          : releaseKind === "japan"
            ? `Vol. ${found?.outJapanVolumes[0] ?? found?.latestJapaneseVolume ?? ""}`
            : `Vol. ${found?.nextVolume ?? found?.latestVolume ?? ""}`,
    };
  };
  // a card as the list draws it, and on New its Hide (or Unhide)
  const card = (currentManga: Manga, i: number) => (
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
        news={
          showingNew
            ? newsFor(
                currentManga,
                releases[currentManga.id],
                releaseKind,
                viewingHidden,
              )
            : undefined
        }
        linkTo={buyLinkFor(currentManga.id)}
        onOpen={
          showingNew && !viewingHidden && grouped(currentManga.id)
            ? () => setOpenRelease(currentManga.id)
            : undefined
        }
        detailsSearch={showingNew ? newDetailsSearch : undefined}
        index={i}
        compact={rowsChosen}
        latestChapter={
          releases[currentManga.id]?.latestChapter ?? currentManga.latestChapter
        }
        select={
          select.selectOn
            ? {
                checked: select.picked.has(currentManga.id),
                onToggle: () => select.toggle(currentManga.id),
              }
            : undefined
        }
      />
      {showingNew && (
        <button
          type="button"
          className={rowsChosen ? styles.seenBtnRow : styles.seenBtn}
          aria-label={`${viewingHidden ? "Unhide" : grouped(currentManga.id) ? "Hide all" : "Hide"}: ${currentManga.name}`}
          data-seen-id={currentManga.id}
          onClick={() => hideActions.hide(currentManga)}
        >
          {!viewingHidden && <CheckIcon />}
          {viewingHidden
            ? "Unhide"
            : grouped(currentManga.id)
              ? "Hide all"
              : "Hide"}
        </button>
      )}
    </div>
  );
  const gridClass = rowsChosen
    ? styles.rowsGrid
    : showingNew
      ? styles.newGrid
      : styles.classContainer;

  return (
    <div className={`fade-in ${styles.library}`}>
      <div className={styles.pageHead}>
        <h1 className={styles.pageTitle}>Your shelf</h1>
        <div className={styles.pageActions}>
          <NavLink
            to="/import"
            data-tour="import-link"
            className={styles.importLink}
            viewTransition
          >
            Import your list
          </NavLink>
          {/* the other way to add: a stack of volumes, by their barcodes. Big
              screens only; on phones the round + offers it */}
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setAdding("scanning")}
            // its code starts loading on the way to a click
            onPointerEnter={() =>
              void import("../../components/scanSheet/ScanSheet")
            }
            onFocus={() => void import("../../components/scanSheet/ScanSheet")}
          >
            <BarcodeIcon className="size-5" />
            Scan a barcode
          </button>
          <button className="btn btn-primary" data-tour="add" onClick={goToAdd}>
            + Add manga
          </button>
        </div>
      </div>

      <ShelfBar
        views={tabs}
        current={tab}
        onPick={(value) => {
          pickTab(value);
          // a new tab starts with Select off, so it never comes back by itself
          select.stop();
          if (wantHidden || pileParam) navigator("/shelf", { replace: true });
        }}
        query={query}
        onQuery={setQuery}
        sortBy={sortBy}
        onSort={(value) => {
          setSortBy(value);
          writeSession("librarySort", value);
        }}
        layout={rowsChosen ? "rows" : "covers"}
        onLayout={(view) => {
          setRowsChosen(view === "rows");
          savePrefs({ shelfView: view }, true);
        }}
        // while selecting, the select bar's Done (or Escape) is the way out
        onSelect={
          !showingNew && tab !== "volumes" && !select.selectOn
            ? select.start
            : undefined
        }
      />

      <HiddenNote
        show={showingNew}
        hidden={hideActions.hidden}
        failed={hideActions.failed}
        noteRef={hideActions.note}
        onUndo={hideActions.undo}
      />

      {select.selectOn ? (
        <SelectDock
          select={select}
          shown={visibleManga}
          page={shelfPage}
          tab={tab}
          raised={undoShowing}
          noteRef={movedNote}
          menuRef={moveMenu}
        />
      ) : (
        <MovedNote select={select} noteRef={movedNote} />
      )}
      {select.confirmingDelete && select.pickedShown.length > 0 && (
        <DeleteManyModal
          manga={select.pickedShown}
          onDelete={select.deletePicked}
          onClose={() => select.setConfirmingDelete(false)}
        />
      )}

      {/* sighted readers see the cards change; this says so to everyone else */}
      <p className="sr-only" role="status">
        {mangaData.length ? `${visibleManga.length} shown` : ""}
      </p>

      {/* what's coming, folded until asked (not on the hidden list) */}
      {/* a thin line at the top once there are cards, staying full once the
          check's done. With no cards yet it sits in the middle of the page,
          where the cards will be */}
      {/* the bar only while answers are missing; an old answer being
          checked again quietly never brings it back */}
      {/* only while answers are missing: nothing to say once they're in,
          and an old answer checked again quietly never brings it back */}
      {showingNew && checking && visibleManga.length > 0 && (
        <div className={styles.checkInline}>
          {progress}
          <p className={styles.checkText} aria-live="polite">
            {`Checking ${checked} of ${total}`}
            {bigShelfNote && ` · ${bigShelfNote}`}
          </p>
        </div>
      )}
      {showingNew && !viewingHidden && !pileView && <UpcomingReleases />}
      {showingNew && (
        <ReleaseTools
          kind={releaseKind}
          onKind={(kind) => {
            setReleaseKind(kind);
            writeSession("libraryReleaseKind", kind);
          }}
          counts={{
            volumes: counts.newVolumes,
            chapters: counts.newChapters,
            japan: counts.newInJapan,
          }}
          showCounts={!allFailed}
          viewingHidden={viewingHidden}
          hiddenCount={hiddenCount}
        />
      )}
      {pileView && (
        <PileHead
          kind={releaseKind}
          view={pileView}
          piles={piles}
          onPick={openPile}
          onBack={() => openPile(null)}
          viewingHidden={viewingHidden}
          extra={pileExtra}
          sort={pileSort}
          onSort={setPileSort}
        />
      )}

      {showingNew && (
        <ReleaseLinks
          viewingHidden={viewingHidden}
          hiddenCount={hiddenCount}
          onOpenHidden={() => navigator("/shelf?view=hidden")}
          onUnhideAll={hideActions.unhideAll}
          onBack={() => navigator("/shelf", { replace: true })}
          hideAllCount={visibleManga.length}
          onHideAll={hideActions.hideAll}
        />
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
      ) : tab === "volumes" ? (
        <VolumesView
          manga={visibleManga}
          searching={Boolean(query.trim())}
          resetKey={filterKey}
        />
      ) : showPiles ? (
        <NewPiles
          kind={releaseKind}
          piles={piles}
          card={card}
          gridClass={gridClass}
          onOpen={openPile}
          returnTo={pileLeft}
          onCardClick={saveSpot}
          linkFor={coverLink}
          extra={pileExtra}
        />
      ) : showingNew && visibleManga.length === 0 && !query.trim() ? (
        <NothingNew
          kind={releaseKind}
          looked={looked.length}
          total={total}
          unknownPlace={unknownPlace}
          notFound={notFound}
          checking={checking}
        />
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
              pickTab("all");
            }}
          >
            Show everything
          </button>
        </div>
      ) : (
        <>
          {/* Select lives in the shelf bar now; this row is the pager's */}
          <div className={styles.gridTools}>{!growing && pager(false)}</div>
          <div
            id="shelf-grid"
            className={gridClass}
            onClickCapture={saveSpot}
            data-tour="shelf"
          >
            {shelfPage.map(card)}
          </div>
          {growing
            ? shelfPage.length < visibleManga.length && (
                <div className={styles.pagerBottom}>
                  <button
                    type="button"
                    className={styles.showMore}
                    onClick={() => changePage(pageIndex + 1, false)}
                  >
                    Show{" "}
                    {Math.min(
                      SHELF_PAGE_SIZE,
                      visibleManga.length - shelfPage.length,
                    )}{" "}
                    more
                    <span className={styles.showMoreCount}>
                      {shelfPage.length} of {visibleManga.length}
                    </span>
                  </button>
                </div>
              )
            : visibleManga.length > SHELF_PAGE_SIZE && (
                <div className={styles.pagerBottom}>{pager(true)}</div>
              )}
        </>
      )}

      {/* how fresh it all is, at the foot, for whoever wonders */}
      {showingNew && !checking && Number.isFinite(oldestCheck) && (
        <p className={styles.checkedFoot}>Checked {checkedAgo(oldestCheck)}</p>
      )}

      {showingNew && openManga && releases[openManga.id] && (
        <ReleaseModal
          manga={openManga}
          found={releases[openManga.id]!}
          kind={SEEN_KIND[releaseKind]}
          onHide={(number, list) =>
            hideActions.hideFromList(openManga, number, list)
          }
          onHideAll={() => {
            setOpenRelease(null);
            hideActions.hide(openManga);
          }}
          onClose={() => setOpenRelease(null)}
        />
      )}

      {!showingNew && <AddButton onClick={() => setAdding("choosing")} />}
      {adding === "choosing" && (
        <AddChoice
          onType={goToAdd}
          onScan={() => setAdding("scanning")}
          // picking one closes the sheet too; only a plain close clears it
          onClose={() => setAdding((now) => (now === "choosing" ? null : now))}
        />
      )}
      {adding === "scanning" && (
        <Suspense fallback={null}>
          <ScanSheet onClose={() => setAdding(null)} />
        </Suspense>
      )}

      <ReleaseTip
        // not over the select bar or the undo note, which share its spot
        enabled={hasManga && !showingNew && !select.selecting && !undoShowing}
        onCheck={() => pickTab("new")}
      />

      <ViewPeek
        series={mangaData.length}
        rows={rowsChosen}
        // not on New, where it sat over the piles' covers
        blocked={
          showingNew ||
          select.selecting ||
          undoShowing ||
          Boolean(hideActions.hidden) ||
          select.movedShowing
        }
        onChoose={(view) => {
          setRowsChosen(view === "rows");
          savePrefs({ shelfView: view }, true);
        }}
      />
    </div>
  );
}
