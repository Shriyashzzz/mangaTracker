// Moving your place, the chapter or the volume, right where it's shown: the one thing people do after
// every read, so it's a tap rather than a trip through the edit form. Saves
// itself a moment after the last tap, so five taps are one request.
import { useEffect, useRef, useState } from "react";
import { apiFetch } from "../../lib/api";
import { useShelf } from "../../store/shelf";
import { detailsStyles as styles } from "./styles";

const SAVE_AFTER_MS = 600;
// the furthest each goes, and where it's saved
const UNITS = {
  chapter: { max: 100000, path: "bookmark", field: "bookmark" },
  volume: { max: 999, path: "reading", field: "readVolume" },
} as const;
type Unit = keyof typeof UNITS;

type Props = {
  mangaId: number;
  value: number | null;
  // what the number counts; a chapter unless said
  unit?: Unit;
  // it's been saved, so anything worked out from the old chapter is stale
  onSaved: (chapter: number) => void;
};

// keepalive: a save sent as they close the tab still arrives
const savePlace = async (mangaId: number, unit: Unit, place: number) => {
  const res = await apiFetch(`/api/manga/${mangaId}/${UNITS[unit].path}`, {
    method: "PATCH",
    body: { [UNITS[unit].field]: place },
    keepalive: true,
  });
  if (!res.ok) throw new Error(`Couldn't save the ${unit}`);
};

export default function ChapterStepper({
  mangaId,
  value,
  unit = "chapter",
  onSaved,
}: Props) {
  const MAX_CHAPTER = UNITS[unit].max;
  const [draft, setDraft] = useState(String(value ?? 0));
  const [note, setNote] = useState<"saved" | "failed" | null>(null);
  // what the server has, to go back to if a save fails
  const saved = useRef(value ?? 0);
  // the chapter still waiting to be saved
  const pending = useRef<number | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  // one save at a time, in order: a slow one can't land after a newer one and
  // put the older chapter back
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const inOrder = (chapter: number) => {
    const save = queue.current.then(() => savePlace(mangaId, unit, chapter));
    queue.current = save.catch(() => {});
    return save;
  };

  const flush = async () => {
    const chapter = pending.current;
    pending.current = null;
    if (chapter == null || chapter === saved.current) return;
    try {
      await inOrder(chapter);
      saved.current = chapter;
      setNote("saved");
      onSaved(chapter);
    } catch {
      // a newer tap is waiting: that one decides what's shown
      if (pending.current != null) return;
      setDraft(String(saved.current));
      setNote("failed");
    }
  };

  const change = (next: string) => {
    setDraft(next);
    setNote(null);
    clearTimeout(timer.current);
    const chapter = Number(next);
    // half-typed or out of range: nothing to save yet
    if (next === "" || !Number.isInteger(chapter) || chapter < 0) return;
    if (chapter > MAX_CHAPTER) return;
    pending.current = chapter;
    timer.current = setTimeout(flush, SAVE_AFTER_MS);
  };

  // leaving straight after a tap still saves it
  useEffect(
    () => () => {
      clearTimeout(timer.current);
      const chapter = pending.current;
      if (chapter != null && chapter !== saved.current) {
        // and the shelf they're going back to shows it
        queue.current
          .then(() => savePlace(mangaId, unit, chapter))
          .then(() => useShelf.getState().load())
          .catch(() => {});
      }
    },
    [mangaId, unit],
  );

  const current = Number(draft) || 0;

  return (
    <span className={styles.stepperWrap}>
      <span className={styles.stepper}>
        <button
          type="button"
          className={styles.stepperBtn}
          aria-label={`One ${unit} back`}
          disabled={current <= 0}
          onClick={() => change(String(current - 1))}
        >
          <svg viewBox="0 0 16 16" aria-hidden>
            <path d="M3 8h10" />
          </svg>
        </button>
        <input
          className={styles.stepperInput}
          style={{ width: `${Math.max(draft.length, 2) + 1.5}ch` }}
          type="number"
          inputMode="numeric"
          min="0"
          max={MAX_CHAPTER}
          step="1"
          aria-label={unit === "volume" ? "Volume read up to" : "Current chapter"}
          value={draft}
          onChange={(e) => change(e.target.value)}
          onBlur={() => {
            if (draft === "") setDraft(String(saved.current));
          }}
        />
        <button
          type="button"
          className={styles.stepperBtn}
          aria-label={`One ${unit} on`}
          data-tour="chapter-up"
          disabled={current >= MAX_CHAPTER}
          onClick={() => change(String(current + 1))}
        >
          <svg viewBox="0 0 16 16" aria-hidden>
            <path d="M3 8h10M8 3v10" />
          </svg>
        </button>
      </span>
      <span
        className={note === "failed" ? styles.saveFailed : styles.saveDone}
        role="status"
      >
        {note === "saved" && "Saved"}
        {note === "failed" && "That didn't save. Try again."}
      </span>
    </span>
  );
}
