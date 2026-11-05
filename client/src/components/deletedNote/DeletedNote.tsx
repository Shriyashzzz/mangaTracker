// After deleting a manga, a few seconds to change your mind: a note pinned to the
// screen. If that was the last one, the empty shelf shows EmptyShelfUndo instead,
// where it can't be missed and doesn't run out, since nothing else is going on.
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useShelf } from "../../store/shelf";

const UNDO_MS = 8000;

// what the note says was deleted: its name, or how many
const deletedLine = (manga: { name: string }[]) =>
  manga.length === 1
    ? `Deleted: ${manga[0]!.name}`
    : `Deleted ${manga.length} series`;

function useUndoDelete() {
  const undoDelete = useShelf((s) => s.undoDelete);
  const [restoring, setRestoring] = useState(false);
  const [problem, setProblem] = useState("");
  const undo = async () => {
    setRestoring(true);
    setProblem("");
    const result = await undoDelete();
    if (result === "failed")
      setProblem("That didn't bring it back. Try again.");
    if (result === "partial") {
      const lost = useShelf.getState().lostOnUndo;
      setProblem(
        `${lost} of them couldn't come back. The rest are on your shelf.`,
      );
    }
    if (result === "already-back")
      setProblem(
        useShelf.getState().lastDeleted?.length === 1
          ? "It's already back on your shelf."
          : "They're already back on your shelf.",
      );
    setRestoring(false);
  };
  return { undo, restoring, problem, setProblem };
}

const undoButton =
  "tap shrink-0 font-medium text-ink underline decoration-accent decoration-2 underline-offset-3";

export default function DeletedNote() {
  const manga = useShelf((s) => s.lastDeleted);
  const shelfEmpty = useShelf((s) => s.manga?.length === 0);
  const setLastDeleted = useShelf((s) => s.setLastDeleted);
  const note = useRef<HTMLDivElement>(null);
  const { undo, restoring, problem, setProblem } = useUndoDelete();
  const showing = manga && !shelfEmpty;
  // the undo's last word ("3 of them couldn't come back") outstays the undo
  const after = !manga && problem;

  useEffect(() => {
    if (!after) return;
    const timer = setTimeout(() => setProblem(""), UNDO_MS);
    return () => clearTimeout(timer);
  }, [after, setProblem]);

  // it leaves on its own, but not from under someone reading or tabbing to it
  useEffect(() => {
    if (!showing) return;
    let timer: ReturnType<typeof setTimeout>;
    const wait = () => {
      timer = setTimeout(() => {
        const box = note.current;
        if (box?.matches(":hover") || box?.querySelector(":focus-visible"))
          wait();
        else setLastDeleted(null);
      }, UNDO_MS);
    };
    wait();
    return () => clearTimeout(timer);
  }, [showing, setLastDeleted]);

  return createPortal(
    <div role="status" ref={note}>
      {(showing || after) && (
        <div
          data-over-add-button
          className="fixed inset-x-0 bottom-6 z-15 mx-auto flex w-fit max-w-[min(30rem,calc(100vw-2rem))] animate-drop items-center gap-4 rounded-ink border-[2.5px] border-line bg-card px-4 py-3 text-[0.95rem] text-ink shadow-ink motion-reduce:animate-none upto-720:bottom-[calc(4.5rem+env(safe-area-inset-bottom))]"
        >
          <span className="min-w-0">
            {problem || (manga ? deletedLine(manga) : "")}
          </span>
          {showing && (
            <button
              type="button"
              className={undoButton}
              disabled={restoring}
              onClick={undo}
            >
              {restoring ? "Undoing…" : "Undo"}
            </button>
          )}
        </div>
      )}
    </div>,
    document.body,
  );
}

// inside the empty shelf's card, for when the last manga has just gone
export function EmptyShelfUndo() {
  const manga = useShelf((s) => s.lastDeleted);
  const { undo, restoring, problem } = useUndoDelete();
  if (!manga) return null;
  return (
    <p
      className="mb-5 flex items-center justify-center gap-3 rounded-ink bg-accent-wash px-3 py-2 text-[0.95rem] text-ink"
      role="status"
    >
      <span className="min-w-0">{problem || deletedLine(manga)}</span>
      <button
        type="button"
        className={undoButton}
        disabled={restoring}
        onClick={undo}
      >
        {restoring ? "Undoing…" : "Undo"}
      </button>
    </p>
  );
}
