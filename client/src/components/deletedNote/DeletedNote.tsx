// After deleting a manga, a few seconds to change your mind: a note pinned to the
// screen. If that was the last one, the empty shelf shows EmptyShelfUndo instead,
// where it can't be missed and doesn't run out, since nothing else is going on.
// How the undo went ("3 of them couldn't come back") is kept in the store, so
// either note can say it, and it outstays the undo itself
import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useShelf } from "../../store/shelf";

const UNDO_MS = 8000;

// what the note says was deleted: its name, or how many
const deletedLine = (manga: { name: string }[]) =>
  manga.length === 1
    ? `Deleted: ${manga[0]!.name}`
    : `Deleted ${manga.length} series`;

const undoButton =
  "tap shrink-0 font-medium text-ink underline decoration-accent decoration-2 underline-offset-3";

function useUndo() {
  const manga = useShelf((s) => s.lastDeleted);
  const undoing = useShelf((s) => s.undoing);
  const message = useShelf((s) => s.undoMessage);
  const undo = () => void useShelf.getState().undoDelete();
  const button = manga && (
    <button
      type="button"
      className={undoButton}
      disabled={undoing}
      onClick={undo}
    >
      {undoing ? "Undoing…" : "Undo"}
    </button>
  );
  const line = message || (manga ? deletedLine(manga) : "");
  return { manga, message, line, button };
}

export default function DeletedNote() {
  const shelfEmpty = useShelf((s) => s.manga?.length === 0);
  const note = useRef<HTMLDivElement>(null);
  const { manga, message, line, button } = useUndo();
  const showing = (manga || message) && !shelfEmpty;

  // it leaves on its own, but not from under someone reading or tabbing to it,
  // or while an undo is still going
  useEffect(() => {
    if (!showing) return;
    let timer: ReturnType<typeof setTimeout>;
    const wait = () => {
      timer = setTimeout(() => {
        const box = note.current;
        const { undoing, setLastDeleted, clearUndoMessage } =
          useShelf.getState();
        if (
          undoing ||
          box?.matches(":hover") ||
          box?.querySelector(":focus-visible")
        )
          wait();
        else {
          setLastDeleted(null);
          clearUndoMessage();
        }
      }, UNDO_MS);
    };
    wait();
    return () => clearTimeout(timer);
  }, [showing, manga, message]);

  return createPortal(
    <div role="status" ref={note}>
      {showing && (
        <div
          data-over-add-button
          className="fixed inset-x-0 bottom-6 z-15 mx-auto flex w-fit max-w-[min(30rem,calc(100vw-2rem))] animate-drop items-center gap-4 rounded-ink border-[2.5px] border-line bg-card px-4 py-3 text-[0.95rem] text-ink shadow-ink motion-reduce:animate-none upto-720:bottom-[calc(4.5rem+env(safe-area-inset-bottom))]"
        >
          <span className="min-w-0">{line}</span>
          {button}
        </div>
      )}
    </div>,
    document.body,
  );
}

// inside the empty shelf's card, for when the last manga has just gone
export function EmptyShelfUndo() {
  const { manga, message, line, button } = useUndo();
  if (!manga && !message) return null;
  return (
    <p
      className="mb-5 flex items-center justify-center gap-3 rounded-ink bg-accent-wash px-3 py-2 text-[0.95rem] text-ink"
      role="status"
    >
      <span className="min-w-0">{line}</span>
      {button}
    </p>
  );
}
