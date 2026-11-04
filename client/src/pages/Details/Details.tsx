import { useEffect, useRef, useState } from "react";
import { detailsStyles as styles } from "./styles";
import { NavLink, useNavigate, useParams, useSearchParams } from "react-router";
import StarRating from "../../components/starRating/StarRating";
import { apiFetch, FALLBACK_COVER } from "../../lib/api";
import type { Manga, ReleaseData, ReleaseStatus } from "../../lib/types";
import SlowLoadQuote from "../../components/slowLoadQuote/SlowLoadQuote";
import { usePrivatePage } from "../../lib/seo";
import { getReleases } from "../../lib/shelf";
import { useReleaseChecksOn } from "../../lib/prefs";
import { useShelf } from "../../store/shelf";
import NotesField from "./NotesField";
import BuyStrip from "./BuyStrip";
import ReleaseBar from "./ReleaseBar";
import ChapterStepper from "./ChapterStepper";
import { useBuyOptions } from "./useBuyOptions";
import { formatCents, priceName, volumePath } from "../../lib/prices";

const DIDNT_SAVE = "That didn't save. Try again.";

export default function Details() {
  usePrivatePage("Manga details");
  const [mangaData, setMangaData] = useState<Manga | null>(null);
  const [releaseData, setReleaseData] = useState<ReleaseData | null>(null);
  const [releaseStatus, setReleaseStatus] = useState<ReleaseStatus | null>(
    null,
  );
  // "signin": the server says it isn't theirs to see; "network": it didn't answer
  const [loadError, setLoadError] = useState<"signin" | "network" | null>(null);
  const [loadTry, setLoadTry] = useState(0);
  // a chapter was saved, so what's new for them needs asking again
  const [chapterSaves, setChapterSaves] = useState(0);
  const { id } = useParams();
  // English unless they came from the shelf's In Japan tab
  const [searchParams] = useSearchParams();
  const inJapan = searchParams.get("edition") === "japan";
  const checksOn = useReleaseChecksOn();
  // or the Chapters side of it, which is about the chapter rather than a volume
  const chapterNews = searchParams.get("new") === "chapter";
  const [mangaStatus, setMangaStatus] = useState(false);
  // on their To read list: not started, so no chapter or release news yet
  const [planned, setPlanned] = useState(false);
  const [mangaRating, setMangaRating] = useState(0);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [ratingFailed, setRatingFailed] = useState(false);
  // under the buttons: a failed save, or the undo for marking it finished
  const [actionNote, setActionNote] = useState("");
  const [canUndoStatus, setCanUndoStatus] = useState(false);
  // marked finished straight from To read: undo puts it back there
  const finishedFromPlanned = useRef(false);
  const deleteButton = useRef<HTMLButtonElement>(null);
  const keepButton = useRef<HTMLButtonElement>(null);
  // the Delete button is about to vanish from under the keyboard: put focus
  // on the safe answer, and back again when they keep it
  const askedDelete = useRef(false);
  useEffect(() => {
    if (confirmDelete) {
      askedDelete.current = true;
      keepButton.current?.focus();
    } else if (askedDelete.current) {
      deleteButton.current?.focus();
    }
  }, [confirmDelete]);
  const navigate = useNavigate();
  const loadedId = mangaData?.id;
  // a light novel's prices are the novel's, never the manga of the same name
  const buyOptions = useBuyOptions(
    mangaData ? priceName(mangaData) : null,
    mangaData?.volumesOwned ?? null,
  );

  useEffect(() => {
    async function getManga() {
      try {
        const response = await apiFetch(`/api/manga/${id}`);
        if (
          response.status === 401 ||
          response.status === 403 ||
          response.status === 404
        ) {
          setLoadError("signin");
          return;
        }
        if (!response.ok) throw new Error(response.statusText);
        const data = await response.json();
        const thisManga = (data as { manga?: Manga }).manga;
        if (!thisManga) throw new Error("Not found");
        setMangaData(thisManga);
        setMangaRating(thisManga.rating ?? 0);
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

  const handleDeleteManga = async () => {
    setBusy(true);
    setActionNote("");
    try {
      // what's on the server right now for the undo: notes, chapter and rating
      // may have changed since this page loaded
      const current = await apiFetch(`/api/manga/${id}`);
      const latest = current.ok
        ? ((await current.json()) as { manga?: Manga }).manga
        : null;
      const res = await apiFetch(`/api/manga/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`Failed deleting manga`);
      useShelf.getState().remove(Number(id));
      useShelf.getState().setLastDeleted(latest ?? mangaData);
      navigate("/shelf", { viewTransition: true });
    } catch (e) {
      console.error(e);
      setActionNote("That didn't delete. Try again.");
      setBusy(false);
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
      setActionNote("Started! You're on chapter 1.");
    } catch (e) {
      console.error(e);
      setPlanned(true);
      setActionNote(DIDNT_SAVE);
    }
  };

  const handleRatingChange = async (newRating: number) => {
    const previous = mangaRating;
    setMangaRating(newRating);
    setRatingFailed(false);
    try {
      const response = await apiFetch(`/api/manga/${id}/rating`, {
        method: "PATCH",
        body: { rating: newRating },
      });
      if (!response.ok) throw new Error(response.statusText);
    } catch (e) {
      console.error(`failed changing manga rating, ${(e as Error).message}`);
      setMangaRating(previous);
      setRatingFailed(true);
    }
  };

  if (loadError === "network") {
    return (
      <div className={styles.errorState} role="alert">
        <h1>Couldn't reach the shelf.</h1>
        <p>The server didn't answer. Check your connection and try again.</p>
        <div className={styles.errorActions}>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              setLoadError(null);
              setLoadTry(loadTry + 1);
            }}
          >
            Try again
          </button>
          <NavLink to="/shelf" className="btn btn-ghost" viewTransition>
            Back to the shelf
          </NavLink>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className={styles.errorState}>
        <h1>Couldn't open this one.</h1>
        <p>It might have been deleted, or you might need to sign in first.</p>
        <div className={styles.errorActions}>
          <NavLink to="/signin" className="btn btn-primary" viewTransition>
            Sign in
          </NavLink>
          <NavLink to="/shelf" className="btn btn-ghost" viewTransition>
            Back to the shelf
          </NavLink>
        </div>
      </div>
    );
  }

  if (!mangaData) return <DetailsSkeleton />;

  const cover = mangaData.image || FALLBACK_COVER;
  const genre =
    mangaData.genre && mangaData.genre !== "unlabled" ? mangaData.genre : null;
  // owning and reading aren't the same, so say which it is
  const volumeYours = mangaData?.volumesOwned
    ? `you own up to vol. ${mangaData.volumesOwned}`
    : releaseStatus?.currentVolume
      ? `you're on vol. ${releaseStatus.currentVolume}`
      : null;
  // the red bar: only what's next for them, and what they came here about
  const release =
    !releaseStatus || !checksOn || planned
      ? null
      : inJapan
        ? releaseStatus.hasNewJapaneseVolume && {
            what: `Vol. ${releaseStatus.latestJapaneseVolume}`,
            kind: "volume" as const,
            yours: volumeYours,
          }
        : chapterNews && !mangaStatus
          ? releaseStatus.hasNewChapter && {
              what: `Ch. ${releaseStatus.latestChapter}`,
              kind: "chapter" as const,
              yours: mangaData.bookmark
                ? `you're on ch. ${mangaData.bookmark}`
                : null,
            }
          : releaseStatus.isNextVolumeOut && {
              what: `Vol. ${releaseStatus.latestVolume}`,
              kind: "volume" as const,
              yours: volumeYours,
            };
  // an English volume release can be bought from the bar: the one they need next,
  // named if that's not the one in the headline
  const sellsVolume =
    release &&
    !inJapan &&
    !(chapterNews && !mangaStatus) &&
    !buyOptions.caughtUp;
  const toBuy = sellsVolume ? (buyOptions.next ?? buyOptions.latest) : null;
  const barBuy = toBuy && {
    to: volumePath(toBuy.isbn13, toBuy.title),
    label: (() => {
      const other = toBuy.volume !== releaseStatus?.latestVolume;
      if (toBuy.knownPriceCents == null) {
        return other ? `Check vol. ${toBuy.volume}` : "Check price";
      }
      const price = formatCents(toBuy.knownPriceCents);
      return other
        ? `Buy vol. ${toBuy.volume} for ${price}`
        : `Buy for ${price}`;
    })(),
  };
  // no need to sell it twice, unless it's the only ticket there is
  const hideNextTicket = Boolean(
    barBuy &&
    buyOptions.next &&
    buyOptions.next.isbn13 !== buyOptions.latest?.isbn13,
  );

  return (
    <div className="fade-in">
      <NavLink to="/shelf" className={styles.backLink} viewTransition>
        ← back to the shelf
      </NavLink>

      <article className={styles.layout}>
        <div className={styles.main}>
          <header className={styles.head}>
            <h1 className={styles.title}>{mangaData.name}</h1>
            <ul className={styles.meta}>
              <li
                className={mangaStatus ? styles.metaDone : styles.metaReading}
              >
                {mangaStatus ? "Finished" : planned ? "To read" : "Reading"}
              </li>
              {mangaData.lightNovel && (
                <li className={styles.metaGenre}>Light novel</li>
              )}
              {genre && <li className={styles.metaGenre}>{genre}</li>}
            </ul>
          </header>

          <h2 className={`${styles.deskTitle} ${styles.yourCopy}`}>
            Your copy
          </h2>
          <p className={styles.progress}>
            {mangaStatus ? (
              <>Read all the way through.</>
            ) : planned ? (
              <span className={styles.startRow}>
                Not started yet.
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={startReading}
                >
                  Start reading
                </button>
              </span>
            ) : (
              <>
                You're on chapter{" "}
                <ChapterStepper
                  key={mangaData.id}
                  mangaId={mangaData.id}
                  value={mangaData.bookmark}
                  onSaved={(chapter) => {
                    setMangaData({ ...mangaData, bookmark: chapter });
                    setChapterSaves((n) => n + 1);
                  }}
                />
              </>
            )}
            {mangaData.volumesOwned && (
              <span className={styles.owned}>
                Own up to vol. {mangaData.volumesOwned}
              </span>
            )}
          </p>

          {release && (
            <ReleaseBar
              key={release.what}
              what={release.what}
              kind={release.kind}
              inJapan={inJapan}
              yours={release.yours || null}
              data={releaseData}
              buy={barBuy}
            />
          )}

          <div className={styles.body}>
            <div className={styles.rating}>
              <span className={styles.label}>
                {mangaRating ? "Your rating. Tap it again to clear" : "Rate it"}
              </span>
              <span className="inline-block w-fit">
                <StarRating
                  value={mangaRating}
                  size="lg"
                  onChange={handleRatingChange}
                />
              </span>
              <p className={styles.saveFailed} role="status">
                {ratingFailed && DIDNT_SAVE}
              </p>
            </div>

            <NotesField
              key={mangaData.id}
              id={mangaData.id}
              initial={mangaData.description}
            />

            <div className={styles.actions}>
              <button
                className="btn btn-secondary"
                onClick={() =>
                  navigate(`/update/${mangaData.id}`, { viewTransition: true })
                }
              >
                Edit details
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => handleStatusChange()}
              >
                {mangaStatus ? "Mark as reading" : "Mark as finished"}
              </button>

              {confirmDelete ? (
                <span className={styles.confirm} role="alert">
                  Delete {mangaData.name} from your shelf? Your chapter, rating
                  and notes go with it, though you'll get a moment to undo.
                  <button
                    className={styles.confirmYes}
                    onClick={handleDeleteManga}
                    disabled={busy}
                  >
                    {busy ? "deleting…" : "yes, delete it"}
                  </button>
                  <button
                    className={styles.confirmNo}
                    ref={keepButton}
                    onClick={() => setConfirmDelete(false)}
                    disabled={busy}
                  >
                    keep it
                  </button>
                </span>
              ) : (
                <button
                  ref={deleteButton}
                  className={`btn btn-ghost ${styles.deleteBtn}`}
                  onClick={() => setConfirmDelete(true)}
                >
                  Delete
                </button>
              )}

              <p className={styles.actionNote} role="status">
                {actionNote}
                {canUndoStatus && (
                  <button
                    type="button"
                    className={styles.undo}
                    onClick={() => handleStatusChange(true)}
                  >
                    Undo
                  </button>
                )}
              </p>
            </div>
          </div>
        </div>

        <div className={styles.side}>
          <figure className={`${styles.cover} ${styles.coverTilt}`}>
            <img
              src={cover}
              alt={mangaData.name}
              onError={(e) => {
                // a dead cover link falls back to the default cover once
                if (e.currentTarget.src !== FALLBACK_COVER) {
                  e.currentTarget.src = FALLBACK_COVER;
                }
              }}
            />
            {mangaStatus && <span className={styles.stamp}>Done</span>}
          </figure>

          <BuyStrip options={buyOptions} hideNext={hideNextTicket} />
        </div>
      </article>
    </div>
  );
}

function DetailsSkeleton() {
  return (
    <div className={styles.layout} aria-busy="true" aria-label="Loading">
      <SlowLoadQuote />
      <div className={styles.main}>
        <div className={styles.head}>
          <div className="skeleton" style={{ width: "60%", height: 44 }} />
          <div className="skeleton" style={{ width: 160, height: 24 }} />
        </div>
        <div className={styles.body}>
          <div className="skeleton" style={{ width: "100%", height: 110 }} />
        </div>
      </div>
      <div className={styles.side}>
        <div className={`skeleton ${styles.cover}`} />
      </div>
    </div>
  );
}
