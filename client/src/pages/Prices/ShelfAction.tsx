import { useEffect, useRef, useState } from "react";
import { NavLink, useLocation } from "react-router";
import { signInPath } from "../../lib/api";
import { findOnShelf, setVolumesOwned, type Owned } from "../../lib/shelf";
import {
  ownedOf,
  ownedVolumes,
  owns,
  withVolume,
} from "../../lib/ownedVolumes";
import { newBook } from "../../lib/books";
import { saveBooks } from "../../lib/booksApi";
import { novelParts } from "../../lib/prices";
import { pricesStyles as styles } from "./styles";
import type { ShelfMatch } from "../../lib/types";
import { useAuth } from "../../store/auth";
import ToReadButton from "../../components/toRead/ToReadButton";
import { useShelf } from "../../store/shelf";
import ToBuyButton from "../../components/toBuy/ToBuyButton";

const UNDO_MS = 6000;

// The volume page's shelf button, which knows what's already there:
//   not on the shelf      -> "+ Add to my to-read" (the series page's own
//                            button: looking at a price isn't owning it),
//                            and "I own Vol. 2", the add form with it owned
//   on it, volume not owned -> "I own Vol. 15", one tap, with undo
// and, while the volume isn't theirs, "+ To buy" keeps it on their To buy
// list (components/toBuy/ToBuyButton.tsx)
//   on it, volume owned     -> shows that, links to the manga
//   signed out            -> sign in, then come back here
// A book of an edition ("VIZBIG 1", holding vols 1 to 3) is on its series'
// own shelf entry, never one of its own: "I own VIZBIG 1" marks every volume
// it holds and records the book, so the entry knows its edition. When its
// line doesn't say what it holds, there's no "I own" (the scan can say)
type Props = {
  // the volume's own ISBN, for the To buy list
  isbn13: string;
  // the series name, as the volume page knows it
  series: string;
  // what to prefill the add form with
  title: string;
  volume: number | null;
  // a book of an edition: its name ("VIZBIG 1"), its own title, and the
  // series' volumes it holds (null when its line doesn't say)
  editionBook?: { name: string; title: string; holds: number[] | null };
  // the series' name as its catalog has it, when that differs ("Dragon Ball
  // Z" beside AniList's "Dragon Ball"): a scan may have used it on the shelf
  alsoCalled?: string;
};

export default function ShelfAction({
  isbn13,
  series,
  title,
  volume,
  editionBook,
  alsoCalled,
}: Props) {
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
    // what was just marked: "vol. 15", "VIZBIG 1"
    what: string;
  } | null>(null);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const undoTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  // the shelf as the to-read button leaves it: asked again once it's added
  const shelfSize = useShelf((s) => s.manga?.length ?? 0);
  useEffect(() => {
    if (!isSignedIn) return;
    const controller = new AbortController();
    findOnShelf(series, controller.signal, alsoCalled)
      .then((manga) => setMatch({ series, manga }))
      .catch((e) => {
        // can't tell: offer adding, which still works
        if ((e as Error).name !== "AbortError")
          setMatch({ series, manga: null });
      });
    return () => controller.abort();
  }, [isSignedIn, series, alsoCalled, shelfSize]);

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
        <p className={styles.trackWhy}>See when the next volume is out.</p>
      </div>
    );
  }
  // still asking (who's signed in, or what's on the shelf): hold the space
  if (!isSignedIn || match.series !== series) {
    return (
      <span
        className={`btn btn-primary ${styles.shelfPending} ${styles.shelfButton}`}
        aria-hidden
      >
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
      <div className={styles.shelfChoices}>
        <ToReadButton name={title} cover={null} />
        {volume != null && !editionBook && (
          <NavLink
            to={`/add?${params}`}
            className="btn btn-secondary btn-sm"
            viewTransition
          >
            I own Vol. {volume}
          </NavLink>
        )}
        <ToBuyButton isbn13={isbn13} />
      </div>
    );
  }

  // what "this" is: the volumes an edition's book holds, or the one volume
  const holds = editionBook
    ? editionBook.holds
    : volume != null
      ? [volume]
      : null;
  const thing = editionBook?.name ?? (volume != null ? `Vol. ${volume}` : null);
  const ownsThis = Boolean(holds?.length && holds.every((v) => owns(manga, v)));
  const before: Owned = {
    volumesOwned: manga.volumesOwned,
    ownedList: manga.ownedList ?? [],
  };
  // this volume as theirs (just it: One Piece 1 and 4 stays without 2 and 3),
  // or, from Undo, back to what it was
  const setOwned = async (next: Owned, tapped?: string) => {
    setSaving(true);
    setFailed(false);
    try {
      const saved = await setVolumesOwned(manga.id, next);
      setMatch({ series, manga: { ...manga, ...saved } });
      clearTimeout(undoTimer.current);
      if (tapped !== undefined) {
        setUndo({ previous: before, what: tapped });
        // an edition's book is recorded too, so its series knows the edition
        if (editionBook?.holds)
          void saveBooks(manga.id, [
            newBook(editionBook.title, editionBook.holds, isbn13),
          ]);
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

  return (
    <div className={styles.shelfAction}>
      <p className={styles.shelfState}>
        {/* just that: how far they are is on the manga's own page */}
        <NavLink to={`/details/${manga.id}`}>On your shelf</NavLink>
      </p>
      {holds?.length && thing && !ownsThis ? (
        <button
          type="button"
          className={`btn btn-primary ${styles.shelfButton}`}
          disabled={saving}
          onClick={() =>
            setOwned(
              editionBook
                ? ownedVolumes(null, [...ownedOf(manga), ...holds])
                : withVolume(manga, holds[0]!),
              editionBook ? thing : `vol. ${holds[0]}`,
            )
          }
        >
          {saving ? "Saving…" : `I own ${thing}`}
        </button>
      ) : (
        <NavLink
          to={`/details/${manga.id}`}
          className={`btn btn-secondary ${styles.shelfButton}`}
          viewTransition
        >
          ✓ {ownsThis && thing ? `You own ${thing}` : "On your shelf"}
        </NavLink>
      )}
      {/* not for a volume that's already theirs */}
      {!ownsThis && (
        <span className={styles.shelfMore}>
          {/* full size, like the shelf button it sits beside */}
          <ToBuyButton isbn13={isbn13} full />
        </span>
      )}
      <p className={styles.shelfNote} role="status">
        {failed
          ? "That didn't save. Try again."
          : undo && (
              <>
                Shelf updated: {undo.what} is yours.{" "}
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
