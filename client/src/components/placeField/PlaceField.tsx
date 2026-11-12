// Where they are in a series, on the add and edit forms: the chapter, the
// volume they've read up to, or both, as their settings say. With each series
// choosing its own way, a link under the box swaps what it counts.
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
    swap: string;
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
  const swap = mode === "series" && (
    <button
      type="button"
      className={classes.swap}
      onClick={() => onByVolume(!byVolume)}
    >
      {byVolume ? "Count chapters instead" : "Count volumes instead"}
    </button>
  );
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
          {swap}
        </div>
      )}
      {tracks.volumes && (
        <div className={classes.field}>
          <label htmlFor="readVolume" className={classes.label}>
            Volume you've read up to{note}
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
          {swap}
        </div>
      )}
    </>
  );
}
