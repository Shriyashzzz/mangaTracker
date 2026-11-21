// A series on their shelf: its little volume shelf, where they are in it,
// what's newly out, their rating and notes, the books they own, and what to
// buy next. This file loads the series and saves changes to it; each part of
// the page is its own file:
//   ShelfBox        the little shelf of ticked volumes
//   ReadingPlace    the chapter and volume counters
//   ReleaseBar      the red "it's out" bar (its rules: releaseNews.ts)
//   RatingField, NotesField, YourBooks
//   RateVolume, YourReviews, ReviewDialog   their reviews of its volumes
//   SeriesActions   Edit, Mark as finished, Delete
//   BuyStrip        the cover's side: what to buy next
import SeriesPicture from "../../components/cover/SeriesPicture";
import type { ShelfVolume } from "../../lib/reviews";
import { useEffect, useMemo, useRef, useState } from "react";
import { NavLink, useNavigate, useParams, useSearchParams } from "react-router";
import { apiFetch } from "../../lib/api";
import { getBooks, ownEditionBook } from "../../lib/booksApi";
import {
  KEPT_NOTE,
  saveOrKeep,
  waitingChanges,
  withChanges,
} from "../../lib/offlineChanges";
import { CAME_BACK } from "../../lib/comeBack";
import { type EditionBook, type EditionLine } from "../../lib/editions";
import { slotsOf } from "../../lib/editionShelf";
import { todayOf } from "../../lib/editionNews";
import { SortMenu } from "../Home/ShelfBar";
import { ownedOf, ownedVolumes as ownedFrom } from "../../lib/ownedVolumes";
import { useReleaseChecksOn, useTrackBy } from "../../lib/prefs";
import { priceName } from "../../lib/prices";
import { tracksOf } from "../../lib/reading";
import { placeOnShelf } from "../../lib/chapterVolumes";
import { usePrivatePage } from "../../lib/seo";
import {
  getReleases,
  saveSeen,
  setOrdered,
  setVolumesOwned,
} from "../../lib/shelf";
import { closeUpcoming, isUpcomingClosed } from "./upcomingClosed";
import type { Manga, ReleaseData, ReleaseStatus } from "../../lib/types";
import { restoredAs, useShelf } from "../../store/shelf";
import BuyStrip from "./BuyStrip";
import { DetailsSkeleton, LoadFailed, type LoadError } from "./DetailsStates";
import NotesField from "./NotesField";
import RateVolume, { RateVolumeCard } from "./RateVolume";
import ReviewDialog from "./ReviewDialog";
import { useRateVolume } from "./useRateVolume";
import { useShelfReviews } from "./useShelfReviews";
import YourReviews from "./YourReviews";
import RatingField from "./RatingField";
import ReadingPlace, { type ReadingChange } from "./ReadingPlace";
import ReleaseBar from "./ReleaseBar";
import { releaseNews, shelfSize } from "./releaseNews";
import SeriesActions from "./SeriesActions";
import ShelfBox from "./ShelfBox";
import { detailsStyles as styles } from "./styles";
import TwiceNote from "./TwiceNote";
import { useBuyOptions } from "./useBuyOptions";
import { useEditions } from "./useEditions";
import { useOwnedVolumes } from "./useOwnedVolumes";
import YourBooks from "./YourBooks";
import { orOffline, useIsOffline } from "../../lib/offline";
import { savedLatestVolume } from "../../lib/releaseCache";

const DIDNT_SAVE = "That didn't save. Try again.";

export default function Details() {
  const { id } = useParams();
  const navigate = useNavigate();
  const trackBy = useTrackBy();
  const checksOn = useReleaseChecksOn();
  const offline = useIsOffline();
  // with no release answer of its own (most often no signal): the latest
  // volume the New tab found, kept on this device, so the shelf still knows
  // what's out. Read once per series
  const seriesId = Number(id);
  const savedLatest = useMemo(() => savedLatestVolume(seriesId), [seriesId]);
  const [searchParams] = useSearchParams();
  // English unless they came from the shelf's In Japan tab
  const inJapan = searchParams.get("edition") === "japan";

  // ---------- what's loaded ----------
  const [mangaData, setMangaData] = useState<Manga | null>(null);
  const [loadError, setLoadError] = useState<LoadError | null>(null);
  const [loadTry, setLoadTry] = useState(0);
  const [releaseData, setReleaseData] = useState<ReleaseData | null>(null);
  const [releaseStatus, setReleaseStatus] = useState<ReleaseStatus | null>(
    null,
  );
  // the series' name once it's in: the tab's title, and the app's top bar
  usePrivatePage(mangaData?.name ?? "Manga details");

  // ---------- what they can change here ----------
  // finished, and on the To read list (not started, so no release news yet).
  // Kept apart from mangaData so a tap shows before the server answers
  const [mangaStatus, setMangaStatus] = useState(false);
  const [planned, setPlanned] = useState(false);
  // a chapter was saved, so what's new for them needs asking again
  const [chapterSaves, setChapterSaves] = useState(0);
  // a new volume counter when its number is set from outside it
  const [volumeSets, setVolumeSets] = useState(0);
  const [deleting, setDeleting] = useState(false);
  // under the buttons: a failed save, or the undo for marking it finished
  const [actionNote, setActionNote] = useState("");

  // ---------- their reviews of its volumes ----------
  // asked for again when what they own or have read changes
  const ownedSoFar = mangaData ? ownedOf(mangaData).length : 0;
  const place = `${ownedSoFar}-${mangaData?.readVolume ?? 0}-${mangaStatus}`;
  const reviews = useShelfReviews(Number(id), place);
  // the volume the page asks them to rate, and whether out loud or quietly
  const volumeRating = useRateVolume(
    `${id}:${place}`,
    Number(id),
    reviews,
    reviews.reload,
  );
  // the volume whose review box is open
  const [reviewing, setReviewing] = useState<ShelfVolume | null>(null);
  const [canUndoStatus, setCanUndoStatus] = useState(false);
  // marked finished straight from To read: undo puts it back there
  const finishedFromPlanned = useRef(false);

  const loadedId = mangaData?.id;
  // the series' omnibus and deluxe lines, and the one they collect. A light
  // novel's prices are the novel's, never the manga of the same name
  // ordered and on their way, and not owned since: Buy next goes past them
  const ordered = mangaData
    ? (mangaData.orderedList ?? []).filter(
        (v) => !ownedOf(mangaData).includes(v),
      )
    : [];
  const buyOptions = useBuyOptions(
    mangaData ? priceName(mangaData) : null,
    ordered.length && mangaData
      ? ownedFrom(null, [...ownedOf(mangaData), ...ordered])
      : {
          volumesOwned: mangaData?.volumesOwned ?? null,
          ownedList: mangaData?.ownedList,
        },
    releaseStatus?.nextChapterVolume ?? null,
  );
  const editions = useEditions(
    mangaData && !mangaData.lightNovel ? priceName(mangaData) : null,
    mangaData?.id ?? null,
    mangaData?.edition,
    // ordered counts as theirs here too: the next book is the one after
    mangaData ? [...ownedOf(mangaData), ...ordered] : [],
    buyOptions.volumes.map((v) => v.isbn13),
    releaseStatus?.nextChapterVolume ?? null,
  );

  // ---------- loading ----------
  useEffect(() => {
    // The series from the shelf list this device keeps (the service worker's
    // copy of /api/manga): with no signal, every series on the shelf opens,
    // not only the ones opened online before. Null when it isn't there
    async function fromKeptShelf(): Promise<Manga | null> {
      const inStore = useShelf
        .getState()
        .manga?.find((m) => m.id === Number(id));
      if (inStore) return inStore;
      try {
        const res = await apiFetch("/api/manga");
        if (!res.ok) return null;
        const { manga } = (await res.json()) as { manga: Manga[] };
        return manga.find((m) => m.id === Number(id)) ?? null;
      } catch {
        return null;
      }
    }
    async function getManga() {
      try {
        let response = await apiFetch(`/api/manga/${id}`).catch(() => null);
        // no signal and this series not kept on its own: the shelf's copy
        if (!response || response.status === 503) {
          const kept = await fromKeptShelf();
          if (!kept) throw new Error("offline");
          response = new Response(JSON.stringify({ manga: kept }));
        }
        // what the server says, not what this page last thought: a session
        // that's expired since still needs a sign in
        if (response.status === 401) {
          setLoadError("signin");
          return;
        }
        if (response.status === 403 || response.status === 404) {
          // deleted, then brought back by Undo under a new id: there
          const movedTo = restoredAs(Number(id));
          if (movedTo) {
            navigate(`/details/${movedTo}${window.location.search}`, {
              replace: true,
            });
            return;
          }
          setLoadError("gone");
          return;
        }
        if (!response.ok) throw new Error(response.statusText);
        const data = await response.json();
        const fromServer = (data as { manga?: Manga }).manga;
        if (!fromServer) throw new Error("Not found");
        // as it is on this device: with what was changed offline, not sent
        const thisManga = withChanges(fromServer, await waitingChanges());
        setMangaData(thisManga);
        if (cameBackNow.current) {
          cameBackNow.current = false;
          setVolumeSets((n) => n + 1);
        }
        setMangaStatus(thisManga.status);
        setPlanned(Boolean(thisManga.planned));
      } catch {
        setLoadError("network");
      }
    }
    getManga();
  }, [id, loadTry, navigate]);

  // back after a while away (lib/comeBack.ts): the series is asked for
  // again, its counters start over from what's saved, and its news is
  // checked again
  // (the counters start over once the fresh series has come: before, they'd
  // start from the old numbers)
  const cameBackNow = useRef(false);
  useEffect(() => {
    const again = () => {
      cameBackNow.current = true;
      setLoadTry((n) => n + 1);
      setChapterSaves((n) => n + 1);
    };
    window.addEventListener(CAME_BACK, again);
    return () => window.removeEventListener(CAME_BACK, again);
  }, []);

  // can take a few seconds, so the page doesn't wait for it. Nice to have: the
  // panel just doesn't appear if this fails
  useEffect(() => {
    // once it's loaded
    if (!checksOn || loadedId == null) return;
    const controller = new AbortController();
    getReleases(Number(id), controller.signal)
      .then((found) => {
        setReleaseData(found.releaseData);
        setReleaseStatus(found.releaseStatus);
      })
      .catch(() => {});
    return () => controller.abort();
  }, [id, chapterSaves, checksOn, loadedId]);

  // ---------- saving ----------
  const handleDeleteManga = async () => {
    setDeleting(true);
    setActionNote("");
    try {
      // what's on the server right now for the undo: notes, chapter and rating
      // may have changed since this page loaded
      const current = await apiFetch(`/api/manga/${id}`);
      const latest = current.ok
        ? ((await current.json()) as { manga?: Manga }).manga
        : null;
      // and its books, which go with it
      const books = await getBooks(Number(id)).catch(() => []);
      const res = await apiFetch(`/api/manga/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`Failed deleting manga`);
      useShelf.getState().remove(Number(id));
      useShelf.getState().setLastDeleted({ ...(latest ?? mangaData!), books });
      navigate("/shelf", { viewTransition: true });
      return true;
    } catch (e) {
      console.error(e);
      setActionNote("That didn't delete. Try again.");
      setDeleting(false);
      return false;
    }
  };

  const handleStatusChange = async (isUndo = false) => {
    const next = !mangaStatus;
    // optimistic, roll back if the server says no
    setMangaStatus(next);
    // the server takes it off the To read list either way
    const wasPlanned = planned;
    setPlanned(false);
    setActionNote("");
    setCanUndoStatus(false);
    try {
      // finished and To read go as one change (each moves the other); with
      // no connection it's kept on this device and goes when it's back
      // (lib/offlineChanges.ts). Undo puts it back on To read if finishing
      // took it off
      const backOnToRead = isUndo && finishedFromPlanned.current;
      const how = await saveOrKeep(
        Number(id),
        "state",
        { status: !next, planned: wasPlanned },
        { status: next, planned: backOnToRead },
        async () => {
          const res = await apiFetch(`/api/manga/${id}/status`, {
            method: "PATCH",
            body: { status: next },
          });
          if (!res.ok || !backOnToRead) return res;
          return apiFetch(`/api/manga/${id}/planned`, {
            method: "PATCH",
            body: { planned: true },
          });
        },
      );
      if (backOnToRead) setPlanned(true);
      finishedFromPlanned.current = !isUndo && next && wasPlanned;
      if (!isUndo) {
        const done = next ? "Marked as finished." : "Back to reading.";
        setActionNote(how === "kept" ? `${done} ${KEPT_NOTE}` : done);
        setCanUndoStatus(true);
      } else if (how === "kept") setActionNote(KEPT_NOTE);
    } catch (e) {
      console.error(e);
      setMangaStatus(!next);
      setPlanned(wasPlanned);
      setActionNote(orOffline(DIDNT_SAVE));
    }
  };

  // "I ordered it", or not after all: saved, then the list as saved
  const orderVolumes = async (volumes: number[], on: boolean) => {
    const orderedList = await setOrdered(Number(id), volumes, on);
    setMangaData((m) => (m ? { ...m, orderedList } : m));
  };

  // which way this series keeps their place, or the volume they've read
  // "I own Deluxe 7" on Buy next: the book and its volumes, then the page
  // shows what they own now
  // the red bar's ×: this release is seen (as New's Hide marks it), so the
  // bar goes until the next one. Gone at once; back if the save fails
  const hideRelease = (seen: {
    kind: "volume" | "chapter";
    number: number;
    upcoming: boolean;
  }) => {
    if (!mangaData) return;
    // still coming: only its notice goes, in this browser. Marking it seen
    // would also hide the day it's out, here and on the New tab
    if (seen.upcoming) {
      closeUpcoming(mangaData.id, seen.kind, seen.number);
      setUpcomingClosedAt((n) => n + 1);
      return;
    }
    const field = seen.kind === "volume" ? "seenVolume" : "seenChapter";
    const before = mangaData[field] ?? null;
    setMangaData((now) => now && { ...now, [field]: seen.number });
    saveSeen(mangaData.id, seen.kind, seen.number).catch(() =>
      setMangaData((now) => now && { ...now, [field]: before }),
    );
  };

  // a coming release's notice just closed: the page draws again without it
  const [, setUpcomingClosedAt] = useState(0);
  const [booksChanged, setBooksChanged] = useState(0);
  const ownBook = async (line: EditionLine, book: EditionBook) => {
    if (!mangaData) return;
    const { owned, books } = await ownEditionBook(
      mangaData.id,
      ownedOf(mangaData),
      line,
      book,
    );
    // onto the page as it is now, not as it was when the tap started
    setMangaData((now) => now && { ...now, ...owned });
    setBooksChanged((n) => n + 1);
    void useShelf.getState().load();
    if (!books) throw new Error("The book didn't save");
  };

  // "On my shelf" on Buy next's single volume: that volume theirs, as
  // tapping its spine does
  const ownVolume = async (volume: number) => {
    if (!mangaData) return;
    const owned = await setVolumesOwned(
      mangaData.id,
      ownedFrom(null, [...ownedOf(mangaData), volume]),
    );
    setMangaData((now) => now && { ...now, ...owned });
    setBooksChanged((n) => n + 1);
    void useShelf.getState().load();
  };

  const saveReading = async (change: ReadingChange) => {
    if (!mangaData) return;
    const was = mangaData;
    setMangaData({ ...mangaData, ...change });
    setActionNote("");
    try {
      const res = await apiFetch(`/api/manga/${id}/reading`, {
        method: "PATCH",
        body: change,
      });
      if (!res.ok) throw new Error("Failed saving how it's read");
      // the counter starts over from what's saved, and its news is asked again
      setChapterSaves((n) => n + 1);
      setVolumeSets((n) => n + 1);
      void useShelf.getState().load();
    } catch (e) {
      console.error(e);
      setMangaData(was);
      setActionNote(orOffline(DIDNT_SAVE));
    }
  };

  // off the To read list and onto Reading, at chapter 1
  const startReading = async () => {
    setPlanned(false);
    setActionNote("");
    try {
      const how = await saveOrKeep(
        Number(id),
        "state",
        { status: false, planned: true },
        { status: false, planned: false },
        () =>
          apiFetch(`/api/manga/${id}/planned`, {
            method: "PATCH",
            body: { planned: false },
          }),
      );
      setMangaData((m) => (m ? { ...m, planned: false, bookmark: 1 } : m));
      const started =
        mangaData && !tracksOf(mangaData, trackBy).chapters
          ? "Started!"
          : "Started! Ch. 1 marked as read.";
      setActionNote(how === "kept" ? `${started} ${KEPT_NOTE}` : started);
    } catch (e) {
      console.error(e);
      setPlanned(true);
      setActionNote(orOffline(DIDNT_SAVE));
    }
  };

  // the volume shelf's ticks, saved one at a time in the background
  const ownedVolumes = useOwnedVolumes({
    manga: mangaData,
    setManga: setMangaData,
    onTick: () => {
      setActionNote("");
      setCanUndoStatus(false);
    },
    onFailed: () => {
      setActionNote(orOffline(DIDNT_SAVE));
      setCanUndoStatus(false);
    },
  });

  if (loadError)
    return (
      <LoadFailed
        error={loadError}
        onRetry={() => {
          setLoadError(null);
          setLoadTry(loadTry + 1);
        }}
      />
    );
  if (!mangaData) return <DetailsSkeleton />;

  const genre =
    mangaData.genre && mangaData.genre !== "unlabled" ? mangaData.genre : null;
  const owned = ownedOf(mangaData);
  const highestOwned = Math.floor(Math.max(0, ...owned));
  const shelfTotal = shelfSize(
    highestOwned,
    releaseStatus?.latestVolume ?? savedLatest,
    buyOptions,
  );
  const shelfPlace = placeOnShelf(
    mangaData,
    tracksOf(mangaData, trackBy),
    releaseData?.volumeStarts ?? [],
  );
  const { release, hideNextTicket } = releaseNews({
    manga: mangaData,
    releaseStatus,
    releaseData,
    buyOptions,
    collectsEdition: Boolean(editions.line),
    edition: editions.line ? { line: editions.line, owned } : null,
    checksOn,
    planned,
    tracksChapters: tracksOf(mangaData, trackBy).chapters,
    highestOwned,
    upcomingClosed: (kind, number) =>
      isUpcomingClosed(mangaData.id, kind, number),
  });

  // The shelf as the edition they collect, when they collect one: its books
  // in place of single volumes, here and in the read counter. Only once we
  // know how many volumes are out (a guess could leave a book off)
  const editionShelf =
    editions.line && shelfTotal.isKnown
      ? {
          line: editions.line,
          slots: slotsOf(editions.line, shelfTotal.size, todayOf()),
        }
      : null;
  // offline, a series they collect in an edition that can't be drawn yet
  // (its books were never kept here) isn't drawn as single volumes instead
  const editionWaits = offline && editions.collects && !editionShelf;

  let statusWord = "Reading";
  if (mangaStatus) statusWord = "Finished";
  else if (planned) statusWord = "To read";

  return (
    <div className="fade-in">
      <NavLink
        to="/shelf"
        className={`${styles.backLink} web-back`}
        viewTransition
      >
        ← back to the shelf
      </NavLink>

      <TwiceNote manga={mangaData} />

      <article className={styles.layout}>
        <div className={styles.main}>
          <div className={styles.titleRow}>
            <header className={styles.head}>
              <h1 className={styles.title}>{mangaData.name}</h1>
              <ul className={styles.meta}>
                <li
                  className={mangaStatus ? styles.metaDone : styles.metaReading}
                >
                  {statusWord}
                </li>
                {mangaData.lightNovel && (
                  <li className={styles.metaGenre}>Light novel</li>
                )}
                {genre && <li className={styles.metaGenre}>{genre}</li>}
                {/* how they collect it, when the series comes in more than
                    single volumes: the shelf, the counter and Buy next all
                    follow it. The same choice as Buy next's "as" */}
                {editions.lines.length > 0 && (
                  <li className={styles.metaEdition}>
                    <SortMenu
                      lead=""
                      menuLabel="Collected as"
                      alignLeft="auto"
                      wordy
                      sortBy={editions.line?.key ?? "singles"}
                      onSort={(edition) => saveReading({ edition })}
                      options={[
                        { value: "singles", label: "Single volumes" },
                        ...editions.lines.map((l) => ({
                          value: l.key,
                          label: l.label,
                        })),
                      ]}
                    />
                  </li>
                )}
              </ul>
            </header>
            {/* phones: Buy it here, above the spines, folded under one line
                that names the book and its price */}
            <div className="hidden upto-720:order-1 upto-720:col-span-full upto-720:block">
              <BuyStrip
                shelfTotal={shelfTotal.isKnown ? shelfTotal.size : 0}
                ownsNone={owned.length === 0}
                folded
                options={buyOptions}
                hideNext={hideNextTicket}
                barSells={release?.sellsIsbn ?? null}
                editions={editions}
                // only when the book offered is the one their next chapter is in
                nextChapters={
                  buyOptions.next &&
                  buyOptions.next.volume === releaseStatus?.nextVolume
                    ? releaseStatus?.nextVolumeChapters
                    : null
                }
                onCollect={(edition) => saveReading({ edition })}
                onOwnBook={ownBook}
                onOwnVolume={ownVolume}
                ordered={ordered}
                onOrdered={orderVolumes}
              />
            </div>
            {editionWaits ? (
              // where the shelf goes, at its width
              <div className={styles.shelf}>
                <p className={styles.shelfCaption}>
                  Your{" "}
                  {editions.line
                    ? `${editions.line.label} books`
                    : "edition's books"}{" "}
                  show once you're back online.
                </p>
              </div>
            ) : (
              <ShelfBox
                mangaId={mangaData.id}
                name={mangaData.name}
                owned={owned}
                total={shelfTotal.size}
                totalKnown={shelfTotal.isKnown}
                ownedVolumes={ownedVolumes}
                place={shelfPlace}
                edition={editionShelf}
                ordered={ordered}
              />
            )}
          </div>

          <ReadingPlace
            manga={mangaData}
            finished={mangaStatus}
            planned={planned}
            trackBy={trackBy}
            owned={owned}
            highestOwned={highestOwned}
            volumeSets={volumeSets}
            edition={editionShelf}
            newestChapter={releaseStatus?.latestChapter ?? null}
            onStart={startReading}
            onChange={saveReading}
            onPlaceSaved={(place) => {
              setMangaData({ ...mangaData, ...place });
              setChapterSaves((n) => n + 1);
            }}
          />

          {release && (
            <ReleaseBar
              key={release.headline}
              headline={release.headline}
              link={release.link}
              onClose={() => hideRelease(release.seen)}
            />
          )}

          <div className={styles.body}>
            {/* the series' rating, and a volume's beside it unless the
                banner under them is asking about one just finished */}
            <div className={styles.ratings}>
              <RatingField
                // starts over from the saved rating when the series changes
                key={`rating-${mangaData.id}`}
                mangaId={mangaData.id}
                initial={mangaData.rating ?? 0}
              />
              {/* not for a series still on To read: nothing's been read */}
              {volumeRating.asked &&
                !planned &&
                (volumeRating.inBanner || volumeRating.showTicket) && (
                  // closed, not gone, while the banner asks: it gives way
                  // smoothly, and is there to take the focus when the banner
                  // is closed
                  <div
                    className={
                      volumeRating.inBanner
                        ? styles.rateSmallClosed
                        : styles.rateSmall
                    }
                    inert={volumeRating.inBanner}
                    data-volume-stars
                  >
                    <div className={styles.rateSmallClip}>
                      <RateVolume
                        volume={volumeRating}
                        onWrite={setReviewing}
                      />
                    </div>
                  </div>
                )}
            </div>

            {volumeRating.inBanner && !planned && (
              <RateVolumeCard volume={volumeRating} onWrite={setReviewing} />
            )}

            <NotesField
              key={mangaData.id}
              id={mangaData.id}
              initial={mangaData.description}
            />

            <YourBooks
              mangaId={mangaData.id}
              owned={owned}
              onRemoved={(left) => setMangaData({ ...mangaData, ...left })}
              lines={editions.lines}
              collects={editionShelf}
              onAdded={(owned) =>
                setMangaData((now) => now && { ...now, ...owned })
              }
              booksChanged={booksChanged}
            />

            <YourReviews written={reviews.written} onEdit={setReviewing} />

            <SeriesActions
              manga={mangaData}
              finished={mangaStatus}
              deleting={deleting}
              note={actionNote}
              canUndo={canUndoStatus}
              onEdit={() =>
                navigate(`/update/${mangaData.id}`, { viewTransition: true })
              }
              onToggleFinished={() => handleStatusChange()}
              onUndoFinished={() => handleStatusChange(true)}
              onDelete={handleDeleteManga}
            />
          </div>
        </div>

        <div className={styles.side}>
          <figure className={`${styles.cover} ${styles.coverTilt}`}>
            <SeriesPicture
              name={mangaData.name}
              lightNovel={mangaData.lightNovel}
              url={mangaData.image}
              sizes="(max-width: 720px) 110px, 240px"
              alt={mangaData.name}
              eager
              japanFirst={inJapan}
              drawnClassName={styles.drawnCover}
            />
            {mangaStatus && <span className={styles.stamp}>Done</span>}
          </figure>

          {/* phones have it folded, high on the page (below) */}
          <div className="upto-720:hidden">
            <BuyStrip
              shelfTotal={shelfTotal.isKnown ? shelfTotal.size : 0}
              ownsNone={owned.length === 0}
              options={buyOptions}
              hideNext={hideNextTicket}
              barSells={release?.sellsIsbn ?? null}
              editions={editions}
              // only when the book offered is the one their next chapter is in
              nextChapters={
                buyOptions.next &&
                buyOptions.next.volume === releaseStatus?.nextVolume
                  ? releaseStatus?.nextVolumeChapters
                  : null
              }
              onCollect={(edition) => saveReading({ edition })}
              onOwnBook={ownBook}
              onOwnVolume={ownVolume}
              ordered={ordered}
              onOrdered={orderVolumes}
            />
          </div>
        </div>
      </article>

      {reviewing && (
        <ReviewDialog
          // a fresh box for each volume
          key={reviewing.volume}
          mangaId={mangaData.id}
          volume={reviewing}
          current={
            reviews.written.find((one) => one.volume === reviewing.volume)
              ?.review ?? null
          }
          onChanged={reviews.reload}
          onClose={() => setReviewing(null)}
        />
      )}
    </div>
  );
}
