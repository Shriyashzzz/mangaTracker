// A note with an undo ("Hidden: Berserk · Undo", "Moved 12 series · Undo")
// that leaves on its own after NOTE_MS, but not from under someone reading it
// or tabbing to its button: it waits again while they're on it. A new note
// starts the wait over. Put the returned ref on the note's wrapper.
import { useEffect, useRef, type Dispatch, type SetStateAction } from "react";
import { NOTE_MS } from "./shelfViews";

export function useLingeringNote<T>(
  // what the note is about, or null when there's none
  note: T | null,
  // the save failed: the note says so instead
  failed: boolean,
  setNote: Dispatch<SetStateAction<T | null>>,
  setFailed: Dispatch<SetStateAction<boolean>>,
) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!note && !failed) return;
    let timer: ReturnType<typeof setTimeout>;
    const wait = () => {
      timer = setTimeout(() => {
        const box = ref.current;
        if (box?.matches(":hover") || box?.querySelector(":focus-visible"))
          wait();
        else {
          setNote(null);
          setFailed(false);
        }
      }, NOTE_MS);
    };
    wait();
    return () => clearTimeout(timer);
  }, [note, failed, setNote, setFailed]);
  return ref;
}
