// Moving your place, the chapter or the volume, right where it's shown: the one thing people do after
// every read, so it's a tap rather than a trip through the edit form. Saves
// itself a moment after the last tap, so five taps are one request.
import { useEffect, useRef, useState } from "react";
import { apiFetch } from "../../lib/api";
import { saveOrKeep } from "../../lib/offlineChanges";
import { useShelf } from "../../store/shelf";
import { detailsStyles as styles } from "./styles";

const SAVE_AFTER_MS = 600;
// how long "Saved" stays; a failed save stays until they try again
const SAVED_SHOWN_MS = 2000;
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
  // the newest out that we know of: a number far past it is a slip of the
  // finger (One Piece at 5000), not saved. A little past is fine: ours can
  // run behind
  newest?: number | null;
  // it's been saved, so anything worked out from the old chapter is stale
  onSaved: (chapter: number) => void;
  // Counting an edition's books instead ("read up to VIZBIG 4"): how many
  // there are, and the volume that reading so many comes to, which is what
  // gets saved (lib/editionShelf.ts). The number shown stays the book's
  books?: {
    count: number;
    volumeAfter: (books: number) => number;
    // what the book they're on holds ("vols. 10–12"), said beside the
    // counter where "Saved" shows
    inside: (books: number) => string;
    // the volume saved now, which can sit partway through a book (vol. 11
    // of VIZBIG 4): sent as where an offline move started from
    savedVolume: number | null;
  };
};

// how far past the newest we know of a chapter may be and still be saved
const PAST_THE_NEWEST = 100;

// keepalive: a save sent as they close the tab still arrives. With no
// connection it's kept on this device and sent when it's back ("kept");
// `from` is what it was moved from, so another device's move meanwhile
// isn't undone (lib/offlineChanges.ts)
const savePlace = async (
  mangaId: number,
  unit: Unit,
  place: number,
  from: number,
) =>
  saveOrKeep(mangaId, UNITS[unit].field, from, place, () =>
    apiFetch(`/api/manga/${mangaId}/${UNITS[unit].path}`, {
      method: "PATCH",
      body: { [UNITS[unit].field]: place },
      keepalive: true,
    }),
  );

export default function ChapterStepper({
  mangaId,
  value,
  unit = "chapter",
  newest = null,
  onSaved,
  books,
}: Props) {
  const MAX_CHAPTER = books ? books.count : UNITS[unit].max;
  // what it counts, in words
  const counted = books ? "book" : unit;
  // what's sent for the number shown
  const toSave = (shown: number) => (books ? books.volumeAfter(shown) : shown);
  // (as it is now, for the save sent as they leave the page)
  const toSaveNow = useRef(toSave);
  useEffect(() => {
    toSaveNow.current = toSave;
  });
  const [draft, setDraft] = useState(String(value ?? 0));
  // "kept": saved on this device, to go when there's a connection
  const [note, setNote] = useState<"saved" | "kept" | "failed" | null>(null);
  // why what's typed isn't being saved, said beside the box
  const [problem, setProblem] = useState<string | null>(null);
  useEffect(() => {
    if (note !== "saved" && note !== "kept") return;
    const hide = setTimeout(() => setNote(null), SAVED_SHOWN_MS);
    return () => clearTimeout(hide);
  }, [note]);
  // what the server has, to go back to if a save fails
  const saved = useRef(value ?? 0);
  // and as it's saved: the number a move starts from. Counting books, the
  // volume saved may be partway through one, so it isn't worked out from
  // the book shown
  const savedPlace = useRef(books ? (books.savedVolume ?? 0) : (value ?? 0));
  // the chapter still waiting to be saved
  const pending = useRef<number | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  // one save at a time, in order: a slow one can't land after a newer one and
  // put the older chapter back
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const inOrder = (chapter: number) => {
    const save = queue.current.then(() =>
      savePlace(mangaId, unit, toSave(chapter), savedPlace.current),
    );
    queue.current = save.catch(() => {});
    return save;
  };

  const flush = async () => {
    const chapter = pending.current;
    pending.current = null;
    if (chapter == null || chapter === saved.current) return;
    try {
      const how = await inOrder(chapter);
      saved.current = chapter;
      savedPlace.current = toSave(chapter);
      setNote(how);
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
    setProblem(null);
    clearTimeout(timer.current);
    // nothing waiting from before: what's typed now decides
    pending.current = null;
    const chapter = Number(next);
    // half-typed: nothing to save yet, and nothing to say
    if (next === "") return;
    // anything else it won't save is said, never left looking saved
    if (!Number.isInteger(chapter) || chapter < 0) {
      setProblem(
        Number.isFinite(chapter) && chapter > 0
          ? `Whole ${counted}s only. Try ${Math.floor(chapter)}.`
          : `That isn't a ${counted} number.`,
      );
      return;
    }
    if (chapter > MAX_CHAPTER) {
      const many = { chapter: "Chapters", volume: "Volumes", book: "Books" };
      setProblem(
        `${many[counted]} go up to ${MAX_CHAPTER.toLocaleString("en-US")}.`,
      );
      return;
    }
    if (unit === "chapter" && newest && chapter > newest + PAST_THE_NEWEST) {
      setProblem(
        `Chapter ${newest.toLocaleString("en-US")} is the newest out.`,
      );
      return;
    }
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
          .then(() =>
            savePlace(
              mangaId,
              unit,
              toSaveNow.current(chapter),
              savedPlace.current,
            ),
          )
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
          aria-label={`One ${counted} back`}
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
          aria-label={
            { chapter: "Chapter", volume: "Volume", book: "Book" }[counted] +
            " read up to"
          }
          value={draft}
          onChange={(e) => change(e.target.value)}
          onBlur={() => {
            // left empty or with something it won't save: back to what's saved
            if (draft === "" || problem) {
              setDraft(String(saved.current));
              setProblem(null);
            }
          }}
        />
        <button
          type="button"
          className={styles.stepperBtn}
          aria-label={`One ${counted} on`}
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
        className={
          note === "failed" || problem ? styles.saveFailed : styles.saveDone
        }
        role="status"
      >
        {problem}
        {!problem && note === "saved" && "Saved"}
        {!problem &&
          note === "kept" &&
          "Kept on this device. It saves when you're back."}
        {!problem && note === "failed" && "That didn't save. Try again."}
        {!problem && !note && books?.inside(current)}
      </span>
    </span>
  );
}
