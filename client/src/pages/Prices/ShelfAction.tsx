import { useEffect, useRef, useState } from "react";
import { NavLink, useLocation } from "react-router";
import { signInPath } from "../../lib/api";
import { findOnShelf, setVolumesOwned, type Owned } from "../../lib/shelf";
import { ownedPhrase, owns, withVolume } from "../../lib/ownedVolumes";
import { novelParts } from "../../lib/prices";
import { pricesStyles as styles } from "./styles";
import type { ShelfMatch } from "../../lib/types";
import { useAuth } from "../../store/auth";

const UNDO_MS = 6000;

// The volume page's shelf button, which knows what's already there:
//   not on the shelf      -> add the series, with this volume as owned
//   on it, volume not owned -> "I own Vol. 15", one tap, with undo
//   on it, volume owned     -> shows that, links to the manga
//   signed out            -> sign in, then come back here
type Props = {
  // the series name, as the volume page knows it
  series: string;
  // what to prefill the add form with
  title: string;
  volume: number | null;
};

export default function ShelfAction({ series, title, volume }: Props) {
  const isSignedIn = useAuth((s) => s.isSignedIn);
  const { pathname } = useLocation();
  // `series` names which lookup this answers, so a stale one never shows
  const [match, setMatch] = useState<{
    series: string | null;
    manga: ShelfMatch;
  }>({ series: null, manga: null });
  // the last "I own" tap, offered back as Undo for a few seconds
  const [undo, setUndo] = useState<{
    previous: Owned;
    volume: number;
  } | null>(null);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const undoTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    if (!isSignedIn) return;
    const controller = new AbortController();
    findOnShelf(series, controller.signal)
      .then((manga) => setMatch({ series, manga }))
      .catch((e) => {
        // can't tell: offer adding, which still works
        if ((e as Error).name !== "AbortError")
          setMatch({ series, manga: null });
      });
    return () => controller.abort();
  }, [isSignedIn, series]);

  useEffect(() => () => clearTimeout(undoTimer.current), []);

  if (isSignedIn === false) {
    return (
      // what tracking gets them, said where they decide: only what the app
      // does today (the New tab, shelf value, what finishing costs)
      <div className={styles.trackPitch}>
        <NavLink
          to={signInPath(pathname)}
          className="btn btn-primary"
          // a sign-in page per volume is nothing for search engines to follow
          rel="nofollow"
          viewTransition
        >
          Track this series, free
        </NavLink>
        <p className={styles.trackWhy}>
          See when the next volume is out, what your shelf is worth and what
          finishing the series costs.
        </p>
      </div>
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
    // a light novel comes in as one, under its own name
    const novel = novelParts(title);
    const params = new URLSearchParams({ title: novel.title });
    if (novel.lightNovel) params.set("format", "novel");
    // they own this volume, which says nothing about the ones before it
    if (volume != null) params.set("ownedVolume", String(volume));
    return (
      <NavLink to={`/add?${params}`} className="btn btn-primary" viewTransition>
        Add series to shelf
      </NavLink>
    );
  }

  const ownsThis = volume != null && owns(manga, volume);
  const before: Owned = {
    volumesOwned: manga.volumesOwned,
    ownedList: manga.ownedList ?? [],
  };
  // this volume as theirs (just it: One Piece 1 and 4 stays without 2 and 3),
  // or, from Undo, back to what it was
  const setOwned = async (next: Owned, tapped?: number) => {
    setSaving(true);
    setFailed(false);
    try {
      const saved = await setVolumesOwned(manga.id, next);
      setMatch({ series, manga: { ...manga, ...saved } });
      clearTimeout(undoTimer.current);
      if (tapped !== undefined) {
        setUndo({ previous: before, volume: tapped });
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
    manga.status
      ? "finished"
      : manga.planned
        ? "on your To read list"
        : manga.bookmark
          ? `chapter ${manga.bookmark}`
          : null,
    ownedPhrase(manga) ? `own ${ownedPhrase(manga)}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className={styles.shelfAction}>
      <p className={styles.shelfState}>
        On your shelf ·{" "}
        <NavLink to={`/details/${manga.id}`}>{progress || "open it"}</NavLink>
      </p>
      {volume != null && !ownsThis ? (
        <button
          type="button"
          className="btn btn-primary"
          disabled={saving}
          onClick={() => setOwned(withVolume(manga, volume), volume)}
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
                Shelf updated: vol. {undo.volume} is yours.{" "}
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
