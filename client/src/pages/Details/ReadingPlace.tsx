// Where they are in a series. One of four things shows:
//   finished          "Read all the way through."
//   on To read        "Not started yet." and a Start reading button
//   no place saved    a choice between tracking chapters and tracking volumes
//   otherwise         the chapter counter, the volume counter, or both
// Which counters show is decided by lib/reading.ts tracksOf.
import { useState } from "react";
import {
  insideOf,
  readPastTheBooks,
  slotsRead,
  volumeReadAfter,
  type EditionShelf,
} from "../../lib/editionShelf";
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
  highestOwned: number;
  // changes when the read volume is set from outside its counter, so the
  // counter starts over from the saved number
  volumeSets: number;
  // the newest chapter out that we know of: a chapter far past it is a slip
  newestChapter?: number | null;
  onStart: () => void;
  onChange: (change: ReadingChange) => void;
  // a counter saved a new chapter or volume
  onPlaceSaved: (place: { bookmark?: number; readVolume?: number }) => void;
  // the shelf seen through the edition they collect: the volume counter
  // then counts its books (lib/editionShelf.ts). Null for single volumes
  edition?: EditionShelf | null;
};

export default function ReadingPlace({
  manga,
  finished,
  planned,
  trackBy,
  highestOwned,
  volumeSets,
  newestChapter = null,
  onStart,
  onChange,
  onPlaceSaved,
  edition = null,
}: Props) {
  // a collector of the books who asked for the chapter counter after all
  const [chaptersShown, setChaptersShown] = useState(false);
  // how many of the edition's books they've read, and the last of them
  const booksRead = edition
    ? slotsRead(edition.slots, manga.readVolume ?? null)
    : 0;
  // counted in the edition's books, unless they've read past its last one:
  // from there on it's single volumes, and the counter says so
  const inBooks =
    edition != null &&
    !readPastTheBooks(edition.slots, manga.readVolume ?? null);

  if (finished)
    return <p className={styles.progress}>Read all the way through.</p>;

  if (planned)
    return (
      <p className={styles.progress}>
        <span className={styles.startRow}>
          Not started yet.
          <button
            type="button"
            className="btn btn-primary btn-sm tap"
            onClick={onStart}
          >
            Start reading
          </button>
        </span>
      </p>
    );

  // no place saved yet: they pick what to count (what they own is the shelf's
  // to say, just above, never repeated here as a list of ranges)
  const nothingSaved =
    trackBy === "series" && !manga.byVolume && !manga.bookmark;
  if (nothingSaved && !chaptersShown)
    return (
      <p className={styles.progress}>
        {/* on its own line: one question, two buttons */}
        <span className={styles.pickPlace}>
          Keep my place by
          {/* together: on a narrow phone both go to the next line, never
              one alone */}
          <span className={styles.pickButtons}>
            <button
              type="button"
              className="btn btn-secondary btn-sm tap"
              onClick={() => setChaptersShown(true)}
            >
              Chapter
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm tap"
              onClick={() => onChange({ byVolume: true })}
            >
              Volume
            </button>
          </span>
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
          You've read up to ch.{" "}
          <ChapterStepper
            // a new one when the series is asked for again (coming back to
            // the app): it starts from what's saved
            key={`${manga.id}-${volumeSets}`}
            mangaId={manga.id}
            value={manga.bookmark}
            newest={newestChapter}
            onSaved={(chapter) => onPlaceSaved({ bookmark: chapter })}
          />
        </span>
      )}
      {tracks.volumes && !inBooks && (
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
      {tracks.volumes && inBooks && edition && (
        // the same place, counted in the edition's books: "VIZBIG 4" is
        // saved as the last volume that book holds
        <span className={styles.placeLine}>
          {/* the edition's name in full ("Definitive", never "Def."): on a
              phone the counter goes under it when they don't fit together */}
          <span className="upto-720:hidden">
            You've read up to {edition.line.label}
          </span>
          <span className="hidden upto-720:inline">
            Read up to {edition.line.label}
          </span>
          <ChapterStepper
            key={`${manga.id}-${edition.line.key}-${volumeSets}`}
            mangaId={manga.id}
            unit="volume"
            value={booksRead}
            books={{
              count: edition.slots.length,
              volumeAfter: (count) => volumeReadAfter(edition.slots, count),
              inside: (count) => {
                const book = edition.slots[count - 1];
                return book ? insideOf(book) : "";
              },
              savedVolume: manga.readVolume ?? null,
            }}
            onSaved={(count) =>
              onPlaceSaved({
                readVolume: volumeReadAfter(edition.slots, count),
              })
            }
          />
        </span>
      )}
      <span className={styles.trackRow}>
        {/* each series its own way: the other one is a tap away */}
        {trackBy === "series" && (
          <button
            type="button"
            className={styles.trackSwitch}
            onClick={() => onChange({ byVolume: !manga.byVolume })}
          >
            {manga.byVolume
              ? "Track chapters instead"
              : "Track volumes instead"}
          </button>
        )}
        {ownsPastWhatTheyveRead && (
          <button
            type="button"
            className={styles.chaptersToo}
            onClick={() => onChange({ readVolume: highestOwned })}
          >
            Read everything I own
          </button>
        )}
      </span>
    </p>
  );
}
