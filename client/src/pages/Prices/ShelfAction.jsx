import { useEffect, useRef, useState } from "react";
import { NavLink, useLocation } from "react-router";
import { signInPath } from "../../lib/api";
import { findOnShelf, setVolumesOwned } from "../../lib/shelf";
import styles from "./Prices.module.css";

const UNDO_MS = 6000;

// The volume page's shelf button, which knows what's already there:
//   not on the shelf      -> add the series, with this volume as owned
//   on it, volume not owned -> "I own Vol. 15", one tap, with undo
//   on it, volume owned     -> shows that, links to the manga
//   signed out            -> sign in, then come back here
export default function ShelfAction({ isSignedIn, series, title, volume }) {
  const { pathname } = useLocation();
  // `series` names which lookup this answers, so a stale one never shows
  const [match, setMatch] = useState({ series: null, manga: null });
  const [undo, setUndo] = useState(null);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const undoTimer = useRef(null);

  useEffect(() => {
    if (!isSignedIn) return;
    const controller = new AbortController();
    findOnShelf(series, controller.signal)
      .then((manga) => setMatch({ series, manga }))
      .catch((e) => {
        // can't tell: offer adding, which still works
        if (e.name !== "AbortError") setMatch({ series, manga: null });
      });
    return () => controller.abort();
  }, [isSignedIn, series]);

  useEffect(() => () => clearTimeout(undoTimer.current), []);

  if (isSignedIn === false) {
    return (
      <NavLink
        to={signInPath(pathname)}
        className="btn btn-primary"
        viewTransition
      >
        Sign in to track this
      </NavLink>
    );
  }
  // still asking (who's signed in, or what's on the shelf): hold the space
  if (!isSignedIn || match.series !== series) {
    return (
      <span className={`btn btn-primary ${styles.shelfPending}`} aria-hidden>
        Add to my shelf
      </span>
    );
  }

  const manga = match.manga;
  if (!manga) {
    const params = new URLSearchParams({ title });
    if (volume != null) params.set("volumesOwned", String(volume));
    return (
      <NavLink to={`/add?${params}`} className="btn btn-primary" viewTransition>
        Add series to shelf
      </NavLink>
    );
  }

  const owned = manga.volumesOwned ?? 0;
  const setOwned = async (value, previous) => {
    setSaving(true);
    setFailed(false);
    try {
      const saved = await setVolumesOwned(manga.id, value);
      setMatch({ series, manga: { ...manga, volumesOwned: saved } });
      clearTimeout(undoTimer.current);
      if (previous !== undefined) {
        setUndo({ previous, volume: value });
        undoTimer.current = setTimeout(() => setUndo(null), UNDO_MS);
      } else {
        setUndo(null);
      }
    } catch {
      setFailed(true);
    } finally {
      setSaving(false);
    }
  };

  const progress = [
    manga.status ? "finished" : `chapter ${manga.bookmark}`,
    owned ? `own up to vol. ${owned}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className={styles.shelfAction}>
      <p className={styles.shelfState}>
        On your shelf ·{" "}
        <NavLink to={`/details/${manga.id}`}>{progress}</NavLink>
      </p>
      {volume != null && owned < volume ? (
        <button
          type="button"
          className="btn btn-primary"
          disabled={saving}
          onClick={() => setOwned(volume, manga.volumesOwned ?? null)}
        >
          {saving ? "Saving…" : `I own Vol. ${volume}`}
        </button>
      ) : (
        <NavLink
          to={`/details/${manga.id}`}
          className="btn btn-secondary"
          viewTransition
        >
          ✓ {volume != null ? `You own Vol. ${volume}` : "On your shelf"}
        </NavLink>
      )}
      <p className={styles.shelfNote} role="status">
        {failed
          ? "That didn't save. Try again."
          : undo && (
              <>
                Shelf updated: you own up to vol. {undo.volume}.{" "}
                <button
                  type="button"
                  className={styles.undoBtn}
                  disabled={saving}
                  onClick={() => setOwned(undo.previous)}
                >
                  Undo
                </button>
              </>
            )}
      </p>
    </div>
  );
}
