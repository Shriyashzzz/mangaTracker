// The shelf: every series they track, as a page of covers (or compact rows),
// with tabs for what they're reading, have finished, want to read, own, and
// what's newly out (New). The parts live beside it:
//
//   shelfViews.ts        what a view shows and says (pure, tested)
//   useShelfTab.ts       which tab is open, in step with the address
//   useSelectMode.ts     Select: move or delete several, with undo
//   useHideActions.ts    the New tab's Hide, Hide all, Unhide all, with undo
//   useShelfShortcuts.ts / and n
//   useAddFlow.ts        the + button's choice, and the scanner sheet
//   useReleaseProgress.ts  the New tab's check: asked for, and how far along
//   usePileView.ts       which pile of the New tab is open (?pile=)
//   newTabLinks.ts       where a card on New leads (pure)
//   ShelfCard.tsx        one series' card, with Hide on the New tab
//   ShelfStates.tsx      empty, unreachable, no matches, still checking
//   SelectDock.tsx, NewTabParts.tsx, AddButton.tsx: what those draw
import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { NavLink, useNavigate } from "react-router";
import { BarcodeIcon } from "../../components/icons/Icons";
import RangePager from "../../components/rangePager/RangePager";
import ReleaseTip from "../../components/whatsNew/ReleaseTip";
import WeeklyEmailPeek from "../../components/weeklyEmailPeek/WeeklyEmailPeek";
import ViewPeek from "../../components/viewPeek/ViewPeek";
import MergeOffer from "./MergeOffer";
import { usePrivatePage } from "../../lib/seo";
import {
  readLocal,
  savePrefs,
  shelfViewNow,
  useNextFor,
} from "../../lib/prefs";
import { SORT_OPTIONS, type ShelfSort } from "../../lib/shelf";
import { shownNewCount, withGapFirst } from "../../lib/releaseMath";
import { editionReleases } from "../../lib/editionNews";
import { ownsAny } from "../../lib/ownedVolumes";
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
  HeldBack,
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
  PILES_FROM,
  catchUpText,
  sortIntoPiles,
  volumesBehind,
  sortPile,
  type Pile,
} from "./piles";
import AddButton from "./AddButton";
import AddChoice from "../../components/scanSheet/AddChoice";
// the camera and its barcode library load only when someone scans
const ScanSheet = lazy(() => import("../../components/scanSheet/ScanSheet"));
import LibrarySkeleton from "./LibrarySkeleton";
import ShowMoreButton from "./ShowMoreButton";
import { inApp } from "../../lib/inApp";
import GuestHero from "./GuestHero";
import {
  BIG_SHELF,
  EARLY_CHECKS,
  filterShelf,
  newsFor,
  opensAList,
  isHiddenAs,
  readSession,
  readSpot,
  RELEASE_KINDS,
  shelfPageSize,
  SHELF_SPOT_KEY,
  shelfCounts,
  writeSession,
  type ReleaseKind,
} from "./shelfViews";
import { useShelfTab } from "./useShelfTab";
import { useSelectMode } from "./useSelectMode";
import { useHideActions } from "./useHideActions";
import { useShelfShortcuts } from "./useShelfShortcuts";
import { usePileView } from "./usePileView";
import { useReleaseProgress } from "./useReleaseProgress";
import { useAddFlow } from "./useAddFlow";
import { buyLinkFor, detailsSearchFor, stampFor } from "./newTabLinks";
import ShelfCard from "./ShelfCard";
import {
  ChecksFailed,
  CheckingWithNothingYet,
  EmptyShelf,
  NoMatches,
  ShelfUnreachable,
} from "./ShelfStates";
import { homeStyles as styles } from "./styles";
import { offlineLink, useIsOffline } from "../../lib/offline";

export default function Home() {
  usePrivatePage("Your shelf");
  const isSignedIn = useAuth((s) => s.isSignedIn);

  if (isSignedIn === null) {
    return <LibrarySkeleton />;
  }
  return isSignedIn ? <Library /> : <GuestHero />;
}

function Library() {
  const offline = useIsOffline();
  // what "Next for you" names for a series with gaps (Settings)
  const nextFor = useNextFor();
  const mangaData = useShelf((s) => s.manga);
  const loadError = useShelf((s) => s.loadFailed);
  // each series' release answer as its reader hears it: one collected as
  // an edition is read in that edition's books (lib/editionNews.ts)
  const answers = useShelf((s) => s.releases);
  const releases = useMemo(
    () => editionReleases(mangaData ?? [], answers),
    [mangaData, answers],
  );
  const outcomes = useShelf((s) => s.outcomes);
  const loadShelf = useShelf((s) => s.load);
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
  const showingNew = tab === "new";
  // the side New opens on: Chapters for a reader who owns no volumes (no
  // buying words for them), else Volumes. Volumes while the shelf loads,
  // so a collector never sees Chapters flash first
  const newOpensOn: ReleaseKind =
    mangaData && !mangaData.some(ownsAny) ? "chapters" : "volumes";
  // on a big New tab, one pile's own page, or everything at once; and which
  // side of New is showing (Volumes, Chapters or In Japan)
  const {
    side: releaseKind,
    setSide: pickKind,
    openList,
    setOpenList,
    pileParam,
    pileView,
    pileSort,
    setPileSort,
    pileLeft,
    openPile,
    backToPiles,
    closePile,
  } = usePileView(showingNew, newOpensOn);
  // set in settings; Kenji's compact-rows offer (ViewPeek) can change it
  // while they're here
  const [rowsChosen, setRowsChosen] = useState(() => shelfViewNow() === "rows");
  const hiddenCount = (mangaData ?? []).filter((m) =>
    isHiddenAs(releases[m.id], releaseKind),
  ).length;
  // showing the last one again leaves nothing here, so it goes back to what's new
  const viewingHidden = tab === "new" && wantHidden && hiddenCount > 0;

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

  const counts = useMemo(
    () => shelfCounts(mangaData ?? [], releases),
    [mangaData, releases],
  );
  // the New tab's release check: how far along it is, and what the last
  // full one found
  const {
    checked,
    checking,
    allChecked,
    oldestCheck,
    checkedBefore,
    lastNewCount,
  } = useReleaseProgress({
    manga: mangaData,
    showingNew,
    rowsChosen,
    checksOn,
    newCount: counts.new,
  });

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
  // a big list of what's new, not searched: sorted into piles instead. So
  // is any list with a series far behind (a series just added at vol. 5 of
  // 22): it goes in "Long reads ahead", never among what's just come out
  const showPiles =
    showingNew &&
    !pileView &&
    !query.trim() &&
    (listed.length >= PILES_FROM || piles.way.length > 0);
  // a pile hidden down to nothing: back to the piles
  const pileEmptied =
    allChecked &&
    pileView !== null &&
    pileView !== "all" &&
    !query.trim() &&
    piles[pileView].length === 0;
  useEffect(() => {
    if (pileEmptied) closePile();
    // only when the pile empties: closePile is made anew on every render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pileEmptied]);
  // a pile's page on a phone grows by "Show 20 more" (or 60) instead of turning
  // pages: one fewer row of controls on a small screen. In the app the whole
  // shelf does, and scrolling near the end shows more by itself
  const growing = (Boolean(pileView) || inApp()) && hasBottomBar();
  const pageSize = shelfPageSize(mangaData?.length ?? 0);
  const shelfPage = visibleManga.slice(
    growing ? 0 : pageIndex * pageSize,
    (pageIndex + 1) * pageSize,
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
  });
  useShelfShortcuts(select.selectOn);

  const goToAdd = () => navigator("/add", { viewTransition: true });
  const addFlow = useAddFlow();
  const loadScanner = () => void import("../../components/scanSheet/ScanSheet");
  const scanSheet = addFlow.adding === "scanning" && (
    <Suspense fallback={null}>
      <ScanSheet onClose={addFlow.close} isbn={addFlow.scanIsbn} />
    </Suspense>
  );

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
      pageSize={pageSize}
      page={pageIndex}
      onChange={(index) => changePage(index, scrollUp)}
      label="Shelf pages"
      labelFor={(start, end) => `${start + 1}–${end + 1}`}
    />
  );

  if (loadError) return <ShelfUnreachable onRetry={loadShelf} />;

  if (mangaData === null) return <LibrarySkeleton />;

  if (mangaData.length === 0)
    return (
      <EmptyShelf
        onAdd={goToAdd}
        onScan={addFlow.scan}
        onScanHover={loadScanner}
      >
        {scanSheet}
      </EmptyShelf>
    );

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
  const openManga = mangaData.find((m) => m.id === openList);

  const total = mangaData.length;
  // a series with no saved place can't be called caught up, so it never shows
  // here. An empty tab has to say so, or it reads as "nothing's out"
  // Only those they're reading: a finished or to-read series isn't waiting
  // on a place
  const hasNoPlace = (m: Manga) => {
    if (m.status || m.planned) return false;
    if (releaseKind === "chapters") return !m.bookmark;
    // (0 is a place: on a chapter in vol. 1, no volume is finished yet)
    return !m.volumesOwned && releases[m.id]?.currentVolume == null;
  };
  const unknownPlace = looked.filter(hasNoPlace).length;
  // of those, ones with a chapter saved: we know where they are, just not
  // which volume that chapter is in (Frieren's chapter list stops at vol. 1)
  const chapterOnly =
    releaseKind === "chapters"
      ? 0
      : looked.filter((m) => hasNoPlace(m) && m.bookmark).length;
  // series with something out that their setting keeps off this list
  // ("only series I'm nearly caught up on"): said when the list is empty
  // when this side of the switch is empty: a side that isn't, to offer
  const sides: { kind: ReleaseKind; count: number }[] = [
    { kind: "volumes", count: counts.newVolumes },
    { kind: "chapters", count: counts.newChapters },
    { kind: "japan", count: counts.newInJapan },
  ];
  const elsewhere = sides.find((s) => s.kind !== releaseKind && s.count > 0);
  const heldBackSeries = looked.filter((m) => {
    const found = releases[m.id];
    if (!found || m.planned) return false;
    if (releaseKind === "volumes")
      return !found.volumeListed && found.nextVolume != null;
    if (releaseKind === "chapters")
      return !found.chapterListed && found.nextChapter != null && !m.status;
    return false;
  });
  const heldBack = heldBackSeries.length;
  // a reader who owns no volumes, held back on Chapters: where each series
  // stands, said instead of "nothing this close" (NewTabParts FarBehind)
  const farBehind =
    releaseKind === "chapters" && newOpensOn === "chapters"
      ? heldBackSeries.map((m) => ({
          name: m.name,
          on: m.bookmark ?? 0,
          latest: releases[m.id]?.latestChapter ?? null,
        }))
      : [];
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
    // while the check is still going the totals are only what's been found
    catchUpText(p, piles[p], releases, releaseKind) +
    (checking && (p === "few" || p === "way") ? " so far" : "");
  // a pile's cover goes where its card would, stamped with which one
  const coverLink = (m: Manga): CoverLink => {
    // their first gap as the next, for a reader who chose that
    const found = withGapFirst(releases[m.id], nextFor);
    const detailsTo = `/details/${m.id}${detailsSearchFor(releaseKind) ?? ""}`;
    // collected as an edition: its next book's price page (buyLinkFor), or
    // the series' page; never a list of single volumes
    const inBooks = releaseKind === "volumes" && Boolean(found?.editionBooks);
    const opensList = !viewingHidden && opensAList(found, releaseKind);
    // Japan being ahead isn't them being behind: no "3 behind" there
    const behind =
      releaseKind === "japan" ? 0 : volumesBehind(found, releaseKind);
    return {
      to: buyLinkFor(found, releaseKind) ?? detailsTo,
      onOpen: opensList ? () => setOpenList(m.id) : undefined,
      stamp: stampFor(found, releaseKind),
      behind: behind > 0 ? behind : undefined,
      // "Book 7" on the stamp, volumes in the count: said so
      ...(releaseKind === "volumes" && found?.nextVolumeInBook && !inBooks
        ? { countWord: "vols" }
        : {}),
    };
  };
  const card = (manga: Manga, index: number) => (
    <ShelfCard
      key={manga.id}
      manga={manga}
      index={index}
      found={releases[manga.id]}
      rows={rowsChosen}
      showingNew={showingNew}
      releaseKind={releaseKind}
      viewingHidden={viewingHidden}
      select={
        select.selectOn
          ? {
              checked: select.picked.has(manga.id),
              onToggle: () => select.toggle(manga.id),
            }
          : undefined
      }
      onOpenReleases={() => setOpenList(manga.id)}
      onHide={() => hideActions.hide(manga)}
    />
  );
  let gridClass: string = styles.classContainer;
  if (rowsChosen) gridClass = styles.rowsGrid;
  else if (showingNew) gridClass = styles.newGrid;

  // the shelf's body: the first of these that applies
  const body = () => {
    const nothingShown = visibleManga.length === 0;
    if (checking && nothingShown)
      return (
        <CheckingWithNothingYet
          early={checked < EARLY_CHECKS}
          waitingText={RELEASE_KINDS[releaseKind].waiting}
          checked={checked}
          total={total}
          bar={progress}
          aside={bigShelfNote}
        />
      );
    if (allFailed) return <ChecksFailed onRetry={recheckReleases} />;
    if (tab === "volumes")
      return (
        <VolumesView
          manga={visibleManga}
          searching={Boolean(query.trim())}
          resetKey={filterKey}
        />
      );
    if (showPiles)
      return (
        <NewPiles
          kind={releaseKind}
          piles={piles}
          onOpen={openPile}
          returnTo={pileLeft}
          onCardClick={saveSpot}
          linkFor={coverLink}
          extra={pileExtra}
        />
      );
    if (showingNew && nothingShown && !query.trim())
      return (
        <NothingNew
          kind={releaseKind}
          looked={looked.length}
          total={total}
          unknownPlace={unknownPlace}
          chapterOnly={chapterOnly}
          notFound={notFound}
          checking={checking}
          heldBack={heldBack}
          farBehind={farBehind}
          // a reader with no volumes isn't sent to the buying list
          elsewhere={farBehind.length ? undefined : elsewhere}
          onKind={pickKind}
        />
      );
    if (nothingShown)
      return (
        <NoMatches
          emptyTab={query.trim() ? null : tab}
          onShowAll={() => {
            setQuery("");
            pickTab("all");
          }}
        />
      );
    return (
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
                <ShowMoreButton
                  className={styles.showMore}
                  bySelf={inApp()}
                  onShowMore={() => changePage(pageIndex + 1, false)}
                >
                  Show{" "}
                  {Math.min(pageSize, visibleManga.length - shelfPage.length)}{" "}
                  more
                  <span className={styles.showMoreCount}>
                    {shelfPage.length} of {visibleManga.length}
                  </span>
                </ShowMoreButton>
              </div>
            )
          : visibleManga.length > pageSize && (
              <div className={styles.pagerBottom}>{pager(true)}</div>
            )}
      </>
    );
  };

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
            {...offlineLink(offline)}
          >
            Import your list
          </NavLink>
          {/* the other way to add: a stack of volumes, by their barcodes. Big
              screens only; on phones the round + offers it */}
          <button
            type="button"
            className="btn btn-secondary"
            data-tour="scan"
            onClick={addFlow.scan}
            // its code starts loading on the way to a click
            onPointerEnter={loadScanner}
            onFocus={loadScanner}
            {...offlineLink(offline)}
          >
            <BarcodeIcon className="size-5" />
            Scan a barcode
          </button>
          <button
            className="btn btn-primary"
            data-tour="add"
            onClick={goToAdd}
            {...offlineLink(offline)}
          >
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
          // kept on their account, like the layout beside it: the shelf
          // opens this way on their other devices too
          savePrefs({ shelfSort: value as ShelfSort }, true);
        }}
        // the Volumes tab is rows only: no choice of layout there
        layout={tab === "volumes" ? undefined : rowsChosen ? "rows" : "covers"}
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

      {/* entries that are one series under different names: on the shelf's
          own tabs, never over a search, Select or the New tab */}
      {!showingNew &&
        tab !== "volumes" &&
        !select.selectOn &&
        !query.trim() &&
        mangaData && <MergeOffer shelf={mangaData} />}

      <HiddenNote
        show={showingNew}
        hidden={hideActions.hidden}
        failed={hideActions.failed}
        noteRef={hideActions.note}
        onUndo={hideActions.undo}
        onAway={hideActions.dismiss}
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
          onKind={pickKind}
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
          onBack={backToPiles}
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

      {body()}

      {/* a list their setting has shortened says so, under it */}
      {showingNew &&
        !viewingHidden &&
        !pileView &&
        heldBack > 0 &&
        visibleManga.length > 0 && (
          <div className="mt-6 text-center">
            <HeldBack count={heldBack} />
          </div>
        )}

      {/* how fresh it all is, at the foot, for whoever wonders */}
      {showingNew && !checking && Number.isFinite(oldestCheck) && (
        <p className={styles.checkedFoot}>Checked {checkedAgo(oldestCheck)}</p>
      )}

      {showingNew && openManga && releases[openManga.id] && (
        <ReleaseModal
          manga={openManga}
          found={releases[openManga.id]!}
          yours={newsFor(openManga, releases[openManga.id], releaseKind).yours}
          kind={releaseKind === "chapters" ? "chapters" : "volumes"}
          onClose={() => setOpenList(null)}
        />
      )}

      {/* not on New, nor on Volumes, where it sat over each row's count */}
      {!showingNew && tab !== "volumes" && (
        <AddButton onClick={addFlow.choose} />
      )}
      {addFlow.adding === "choosing" && (
        <AddChoice
          onType={goToAdd}
          onScan={addFlow.scan}
          onClose={addFlow.closeChoice}
        />
      )}
      {scanSheet}

      <ReleaseTip
        // not over the select bar or the undo note, which share its spot
        enabled={hasManga && !showingNew && !select.selecting && !undoShowing}
        onCheck={() => pickTab("new")}
      />

      <WeeklyEmailPeek
        blocked={
          showingNew ||
          select.selecting ||
          undoShowing ||
          Boolean(hideActions.hidden) ||
          select.movedShowing
        }
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
