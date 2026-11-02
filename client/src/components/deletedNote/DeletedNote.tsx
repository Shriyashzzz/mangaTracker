// After deleting a manga, a few seconds to change your mind. Here in the frame
// rather than on the shelf, which shows something else entirely once it's empty.
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { apiFetch } from "../../lib/api";
import { useShelf } from "../../store/shelf";

const UNDO_MS = 8000;

export default function DeletedNote() {
  const manga = useShelf((s) => s.lastDeleted);
  const setLastDeleted = useShelf((s) => s.setLastDeleted);
  const load = useShelf((s) => s.load);
  const note = useRef<HTMLDivElement>(null);
  const [restoring, setRestoring] = useState(false);
  const [failed, setFailed] = useState(false);

  // it leaves on its own, but not from under someone reading or tabbing to it
  useEffect(() => {
    if (!manga) return;
    let timer: ReturnType<typeof setTimeout>;
    const wait = () => {
      timer = setTimeout(() => {
        const box = note.current;
        if (box?.matches(":hover") || box?.querySelector(":focus-visible")) wait();
        else {
          setFailed(false);
          setLastDeleted(null);
        }
      }, UNDO_MS);
    };
    wait();
    return () => clearTimeout(timer);
  }, [manga, setLastDeleted]);

  const undo = async () => {
    if (!manga) return;
    setRestoring(true);
    setFailed(false);
    try {
      const res = await apiFetch("/api/manga/restore", {
        method: "POST",
        body: manga,
      });
      if (!res.ok) throw new Error(res.statusText);
      await load();
      setLastDeleted(null);
    } catch {
      setFailed(true);
    } finally {
      setRestoring(false);
    }
  };

  return createPortal(
    <div role="status" ref={note}>
      {manga && (
        <div
          data-over-add-button
          className="fixed inset-x-0 bottom-6 z-15 mx-auto flex w-fit max-w-[min(30rem,calc(100vw-2rem))] animate-drop items-center gap-4 rounded-ink border-[2.5px] border-line bg-card px-4 py-3 text-[0.95rem] text-ink shadow-ink motion-reduce:animate-none upto-720:bottom-[calc(3.75rem+env(safe-area-inset-bottom))]"
        >
          <span className="min-w-0 truncate">
            {failed ? "That didn't bring it back. Try again." : `Deleted: ${manga.name}`}
          </span>
          <button
            type="button"
            className="tap shrink-0 font-medium text-ink underline decoration-accent decoration-2 underline-offset-3"
            disabled={restoring}
            onClick={undo}
          >
            {restoring ? "Undoing…" : "Undo"}
          </button>
        </div>
      )}
    </div>,
    document.body,
  );
}
