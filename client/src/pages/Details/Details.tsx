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
import { useEffect, useRef, useState } from "react";
import { NavLink, useNavigate, useParams, useSearchParams } from "react-router";
import { apiFetch } from "../../lib/api";
import { getBooks } from "../../lib/booksApi";
import { ownedOf } from "../../lib/ownedVolumes";
import { useReleaseChecksOn, useTrackBy } from "../../lib/prefs";
import { priceName } from "../../lib/prices";
import { tracksOf } from "../../lib/reading";
import { placeOnShelf } from "../../lib/chapterVolumes";
import { usePrivatePage } from "../../lib/seo";
import { getReleases } from "../../lib/shelf";
import type { Manga, ReleaseData, ReleaseStatus } from "../../lib/types";
import { useShelf } from "../../store/shelf";
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

const DIDNT_SAVE = "That didn't save. Try again.";

export default function Details() {
  usePrivatePage("Manga details");
  const { id } = useParams();
  const navigate = useNavigate();
  const trackBy = useTrackBy();
  const checksOn = useReleaseChecksOn();
  const [searchParams] = useSearchParams();
  // English unless they came from the shelf's In Japan tab
  const inJapan = searchParams.get("edition") === "japan";
  // or the Chapters side of it, which is about the chapter rather than a volume
  const chapterNews = searchParams.get("new") === "chapter";

  // ---------- what's loaded ----------
  const [mangaData, setMangaData] = useState<Manga | null>(null);
  const [loadError, setLoadError] = useState<LoadError | null>(null);
  const [loadTry, setLoadTry] = useState(0);
  const [releaseData, setReleaseData] = useState<ReleaseData | null>(null);
  const [releaseStatus, setReleaseStatus] = useState<ReleaseStatus | null>(
    null,
  );

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
  const editions = useEditions(
    mangaData && !mangaData.lightNovel ? priceName(mangaData) : null,
    mangaData?.id ?? null,
    mangaData?.edition,
    mangaData ? ownedOf(mangaData) : [],
  );
  const buyOptions = useBuyOptions(
    mangaData ? priceName(mangaData) : null,
    {
      volumesOwned: mangaData?.volumesOwned ?? null,
      ownedList: mangaData?.ownedList,
    },
    releaseStatus?.nextChapterVolume ?? null,
  );

  // ---------- loading ----------
  useEffect(() => {
    async function getManga() {
      try {
        const response = await apiFetch(`/api/manga/${id}`);
        // what the server says, not what this page last thought: a session
        // that's expired since still needs a sign in
        if (response.status === 401) {
          setLoadError("signin");
          return;
        }
        if (response.status === 403 || response.status === 404) {
          setLoadError("gone");
          return;
        }
        if (!response.ok) throw new Error(response.statusText);
        const data = await response.json();
        const thisManga = (data as { manga?: Manga }).manga;
        if (!thisManga) throw new Error("Not found");
        setMangaData(thisManga);
        setMangaStatus(thisManga.status);
        setPlanned(Boolean(thisManga.planned));
      } catch {
        setLoadError("network");
      }
    }
    getManga();
  }, [id, loadTry]);

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
    } catch (e) {
      console.error(e);
      setActionNote("That didn't delete. Try again.");
      setDeleting(false);
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
      const res = await apiFetch(`/api/manga/${id}/status`, {
        method: "PATCH",
        body: { status: next },
      });
      if (!res.ok) throw new Error(`Failed changing manga status`);
      if (isUndo && finishedFromPlanned.current) {
        const back = await apiFetch(`/api/manga/${id}/planned`, {
          method: "PATCH",
          body: { planned: true },
        });
        if (back.ok) setPlanned(true);
      }
      finishedFromPlanned.current = !isUndo && next && wasPlanned;
      if (!isUndo) {
        setActionNote(next ? "Marked as finished." : "Back to reading.");
        setCanUndoStatus(true);
      }
    } catch (e) {
      console.error(e);
      setMangaStatus(!next);
      setPlanned(wasPlanned);
      setActionNote(DIDNT_SAVE);
    }
  };

  // which way this series keeps their place, or the volume they've read
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
      setActionNote(DIDNT_SAVE);
    }
  };

  // off the To read list and onto Reading, at chapter 1
  const startReading = async () => {
    setPlanned(false);
    setActionNote("");
    try {
      const res = await apiFetch(`/api/manga/${id}/planned`, {
        method: "PATCH",
        body: { planned: false },
      });
      if (!res.ok) throw new Error("Failed starting manga");
      setMangaData((m) => (m ? { ...m, planned: false, bookmark: 1 } : m));
      setActionNote(
        mangaData && !tracksOf(mangaData, trackBy).chapters
          ? "Started!"
          : "Started! Ch. 1 marked as read.",
      );
    } catch (e) {
      console.error(e);
      setPlanned(true);
      setActionNote(DIDNT_SAVE);
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
      setActionNote(DIDNT_SAVE);
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
  const shelfTotal = shelfSize(highestOwned, releaseStatus, buyOptions);
  const shelfPlace = placeOnShelf(
    mangaData,
    tracksOf(mangaData, trackBy),
    releaseData?.volumeStarts ?? [],
  );
  const { release, barBuy, barEnglish, hideNextTicket } = releaseNews({
    manga: mangaData,
    releaseStatus,
    buyOptions,
    collectsEdition: Boolean(editions.line),
    checksOn,
    planned,
    finished: mangaStatus,
    inJapan,
    chapterNews,
    tracksChapters: tracksOf(mangaData, trackBy).chapters,
    highestOwned,
  });

  let statusWord = "Reading";
  if (mangaStatus) statusWord = "Finished";
  else if (planned) statusWord = "To read";

  return (
    <div className="fade-in">
      <NavLink to="/shelf" className={styles.backLink} viewTransition>
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
              </ul>
            </header>
            {/* phones: Buy it here, above the spines, folded under one line
                that names the book and its price */}
            <div className="hidden upto-720:order-1 upto-720:col-span-full upto-720:block">
              <BuyStrip
                folded
                options={buyOptions}
                hideNext={hideNextTicket}
                editions={editions}
                // only when the book offered is the one their next chapter is in
                nextChapters={
                  buyOptions.next &&
                  buyOptions.next.volume === releaseStatus?.nextVolume
                    ? releaseStatus?.nextVolumeChapters
                    : null
                }
                onCollect={(edition) => saveReading({ edition })}
              />
            </div>
            <ShelfBox
              mangaId={mangaData.id}
              name={mangaData.name}
              owned={owned}
              total={shelfTotal.size}
              totalKnown={shelfTotal.isKnown}
              ownedVolumes={ownedVolumes}
              place={shelfPlace}
            />
          </div>

          <ReadingPlace
            manga={mangaData}
            finished={mangaStatus}
            planned={planned}
            trackBy={trackBy}
            owned={owned}
            highestOwned={highestOwned}
            volumeSets={volumeSets}
            onStart={startReading}
            onChange={saveReading}
            onPlaceSaved={(place) => {
              setMangaData({ ...mangaData, ...place });
              setChapterSaves((n) => n + 1);
            }}
          />

          {release && (
            <ReleaseBar
              key={release.what}
              what={release.what}
              kind={release.kind}
              inJapan={inJapan}
              yours={release.yours}
              data={releaseData}
              buy={barBuy}
              english={
                release.kind === "volume" && !inJapan ? barEnglish : null
              }
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
            />

            <YourReviews written={reviews.written} onEdit={setReviewing} />

            <SeriesActions
              name={mangaData.name}
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
              options={buyOptions}
              hideNext={hideNextTicket}
              editions={editions}
              // only when the book offered is the one their next chapter is in
              nextChapters={
                buyOptions.next &&
                buyOptions.next.volume === releaseStatus?.nextVolume
                  ? releaseStatus?.nextVolumeChapters
                  : null
              }
              onCollect={(edition) => saveReading({ edition })}
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
