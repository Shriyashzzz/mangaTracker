// "Your copy": where they are in a series. One of four things shows:
//   finished          "Read all the way through."
//   on To read        "Not started yet." and a Start reading button
//   no place saved    a choice between tracking chapters and tracking volumes
//   otherwise         the chapter counter, the volume counter, or both
// Which counters show is decided by lib/reading.ts tracksOf.
import { useState } from "react";
import { rangesText } from "../../lib/ownedVolumes";
import { tracksOf, type TrackBy } from "../../lib/reading";
import type { Manga } from "../../lib/types";
import ChapterStepper from "./ChapterStepper";
import { detailsStyles as styles } from "./styles";

// a change to how the series is read, saved by the page
export type ReadingChange = {
  byVolume?: boolean;
  readVolume?: number;
  edition?: string;
};

type Props = {
  manga: Manga;
  finished: boolean;
  planned: boolean;
  // the Settings choice: each series its own way, or one way for all
  trackBy: TrackBy;
  // the volumes they own
  owned: number[];
  highestOwned: number;
  // changes when the read volume is set from outside its counter, so the
  // counter starts over from the saved number
  volumeSets: number;
  onStart: () => void;
  onChange: (change: ReadingChange) => void;
  // a counter saved a new chapter or volume
  onPlaceSaved: (place: { bookmark?: number; readVolume?: number }) => void;
};

export default function ReadingPlace({
  manga,
  finished,
  planned,
  trackBy,
  owned,
  highestOwned,
  volumeSets,
  onStart,
  onChange,
  onPlaceSaved,
}: Props) {
  // a collector of the books who asked for the chapter counter after all
  const [chaptersShown, setChaptersShown] = useState(false);

  if (finished)
    return <p className={styles.progress}>Read all the way through.</p>;

  if (planned)
    return (
      <p className={styles.progress}>
        <span className={styles.startRow}>
          Not started yet.
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={onStart}
          >
            Start reading
          </button>
        </span>
      </p>
    );

  // no place saved yet: they pick what to count. What they own says where a
  // collector is, never "chapter 0"
  const nothingSaved =
    trackBy === "series" && !manga.byVolume && !manga.bookmark;
  if (nothingSaved && !chaptersShown)
    return (
      <p className={styles.progress}>
        <span className={styles.startRow}>
          {owned.length > 0 && (
            <>
              You own {owned.length === 1 ? "vol." : "vols."}{" "}
              {rangesText(owned)}.
            </>
          )}
          <button
            type="button"
            className={styles.chaptersToo}
            onClick={() => setChaptersShown(true)}
          >
            Keep my place by chapter
          </button>
          <button
            type="button"
            className={styles.chaptersToo}
            onClick={() => onChange({ byVolume: true })}
          >
            Keep my place by volume
          </button>
        </span>
      </p>
    );

  const tracks = tracksOf(manga, trackBy);
  const ownsPastWhatTheyveRead =
    tracks.volumes && highestOwned > (manga.readVolume ?? 0);
  return (
    <p className={styles.progress}>
      {tracks.chapters && (
        <span className={styles.placeLine}>
          You're on chapter{" "}
          <ChapterStepper
            key={manga.id}
            mangaId={manga.id}
            value={manga.bookmark}
            onSaved={(chapter) => onPlaceSaved({ bookmark: chapter })}
          />
        </span>
      )}
      {tracks.volumes && (
        // their place by the volume: read is apart from owned
        <span className={styles.placeLine}>
          You've read up to vol.{" "}
          <ChapterStepper
            key={`${manga.id}-volume-${volumeSets}`}
            mangaId={manga.id}
            unit="volume"
            value={manga.readVolume ?? null}
            onSaved={(volume) => onPlaceSaved({ readVolume: volume })}
          />
        </span>
      )}
      <span className={styles.trackRow}>
        {ownsPastWhatTheyveRead && (
          <button
            type="button"
            className={styles.chaptersToo}
            onClick={() => onChange({ readVolume: highestOwned })}
          >
            Read everything I own
          </button>
        )}
        {/* each series its own way: the other one is a tap away */}
        {trackBy === "series" && (
          <button
            type="button"
            className={styles.chaptersToo}
            onClick={() => onChange({ byVolume: !manga.byVolume })}
          >
            {manga.byVolume
              ? "Track chapters instead"
              : "Track volumes instead"}
          </button>
        )}
      </span>
    </p>
  );
}
