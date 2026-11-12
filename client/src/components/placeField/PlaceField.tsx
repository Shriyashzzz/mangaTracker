// Where they are in a series, on the add and edit forms: the chapter, the
// volume they've read up to, or both, as their settings say. With each series
// choosing its own way, a small switch beside the label says what the box counts.
import { tracksOf, type TrackBy } from "../../lib/reading";

type Props = {
  mode: TrackBy;
  byVolume: boolean;
  onByVolume: (byVolume: boolean) => void;
  chapter: string;
  onChapter: (chapter: string) => void;
  volume: string;
  onVolume: (volume: string) => void;
  chapterError?: string;
  optional?: boolean;
  // the form's own looks
  classes: {
    field: string;
    label: string;
    input: string;
    fieldError: string;
    optional?: string;
    invalid?: string;
    unitRow: string;
    unitSwitch: string;
    unitLabel: string;
  };
};

export default function PlaceField({
  mode,
  byVolume,
  onByVolume,
  chapter,
  onChapter,
  volume,
  onVolume,
  chapterError,
  optional,
  classes,
}: Props) {
  const tracks = tracksOf({ byVolume }, mode);
  const note = optional && (
    <span className={classes.optional}> (optional)</span>
  );
  // each series its own way: one box, and a small switch for what it counts
  if (mode === "series") {
    const id = byVolume ? "readVolume" : "bookmark";
    return (
      <div className={classes.field}>
        <div className={classes.unitRow}>
          <label htmlFor={id} className={classes.label}>
            You're on
          </label>
          <span
            className={classes.unitSwitch}
            role="radiogroup"
            aria-label="Track this series by"
          >
            <input
              type="radio"
              id="place-chapter"
              name="placeUnit"
              checked={!byVolume}
              onChange={() => onByVolume(false)}
            />
            <label htmlFor="place-chapter" className={classes.unitLabel}>
              Chapter
            </label>
            <input
              type="radio"
              id="place-volume"
              name="placeUnit"
              checked={byVolume}
              onChange={() => onByVolume(true)}
            />
            <label htmlFor="place-volume" className={classes.unitLabel}>
              Volume
            </label>
          </span>
        </div>
        <input
          className={`${classes.input} ${!byVolume && chapterError ? (classes.invalid ?? "") : ""}`}
          inputMode="numeric"
          id={id}
          name={id}
          type="number"
          min="0"
          max={byVolume ? "999" : undefined}
          step="1"
          value={byVolume ? volume : chapter}
          placeholder={byVolume ? "e.g. 12" : "e.g. 1073"}
          aria-invalid={(!byVolume && Boolean(chapterError)) || undefined}
          aria-describedby={
            !byVolume && chapterError ? "bookmark-error" : undefined
          }
          onChange={(e) =>
            byVolume ? onVolume(e.target.value) : onChapter(e.target.value)
          }
        />
        {!byVolume && chapterError && (
          <p id="bookmark-error" className={classes.fieldError}>
            {chapterError}
          </p>
        )}
      </div>
    );
  }
  return (
    <>
      {tracks.chapters && (
        <div className={classes.field}>
          <label htmlFor="bookmark" className={classes.label}>
            Current chapter{note}
          </label>
          <input
            className={`${classes.input} ${chapterError ? (classes.invalid ?? "") : ""}`}
            inputMode="numeric"
            id="bookmark"
            name="bookmark"
            type="number"
            min="0"
            step="1"
            value={chapter}
            placeholder="e.g. 1073"
            aria-invalid={Boolean(chapterError) || undefined}
            aria-describedby={chapterError ? "bookmark-error" : undefined}
            onChange={(e) => onChapter(e.target.value)}
          />
          {chapterError && (
            <p id="bookmark-error" className={classes.fieldError}>
              {chapterError}
            </p>
          )}
        </div>
      )}
      {tracks.volumes && (
        <div className={classes.field}>
          <label htmlFor="readVolume" className={classes.label}>
            Current volume{note}
          </label>
          <input
            className={classes.input}
            inputMode="numeric"
            id="readVolume"
            name="readVolume"
            type="number"
            min="0"
            max="999"
            step="1"
            value={volume}
            placeholder="e.g. 12"
            onChange={(e) => onVolume(e.target.value)}
          />
        </div>
      )}
    </>
  );
}
