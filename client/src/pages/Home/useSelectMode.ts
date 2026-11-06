// The shelf's Select: tick cards, then move them to another tab or delete them
// together, with an undo for the move. Only what the view shows counts as
// ticked, so nothing hidden by a tab or search is ever moved or deleted.
// Escape leaves (the Move to menu closes first); a tap outside closes the menu.
import { useEffect, useRef, useState } from "react";
import type { Manga } from "../../lib/types";
import { useShelf, type ShelfMove, type ShelfPlace } from "../../store/shelf";
import { useLingeringNote } from "./useLingeringNote";

export type Moved = { to: ShelfMove; was: ShelfPlace[]; name: string };

export function useSelectMode({
  canSelect,
  shown,
}: {
  // not on New or Volumes, where a card does something else
  canSelect: boolean;
  // what the view shows right now
  shown: Manga[];
}) {
  const [selecting, setSelecting] = useState(false);
  const [picked, setPicked] = useState<Set<number>>(() => new Set());
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  // Move to: its menu, and what was moved for the undo
  const [moveOpen, setMoveOpen] = useState(false);
  const [moving, setMoving] = useState(false);
  const [moved, setMoved] = useState<Moved | null>(null);
  const [moveFailed, setMoveFailed] = useState(false);
  const moveMenu = useRef<HTMLDivElement>(null);
  // "Moved 12 series to Finished · Undo" leaves on its own
  const movedNote = useLingeringNote(
    moved,
    moveFailed,
    setMoved,
    setMoveFailed,
  );
  const selectOn = selecting && canSelect;

  const stop = () => {
    setSelecting(false);
    setPicked(new Set());
  };

  useEffect(() => {
    if (!selectOn) return;
    const leave = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      // the confirm dialog's own Escape closes just the dialog, and the
      // search's clears the search
      if (document.querySelector("dialog[open]")) return;
      // the Move to menu closes first
      if (moveOpen) {
        setMoveOpen(false);
        moveMenu.current?.querySelector("button")?.focus();
        return;
      }
      // a ticked card's box still leaves; a text box keeps its Escape
      if (
        (e.target as Element | null)?.closest(
          "input:not([type=checkbox]), textarea, select",
        )
      )
        return;
      setSelecting(false);
      setPicked(new Set());
    };
    window.addEventListener("keydown", leave);
    return () => window.removeEventListener("keydown", leave);
  }, [selectOn, moveOpen]);

  // a tap anywhere else closes the menu
  useEffect(() => {
    if (!moveOpen) return;
    const away = (e: PointerEvent) => {
      if (!moveMenu.current?.contains(e.target as Node)) setMoveOpen(false);
    };
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, [moveOpen]);

  // only what this tab and search show counts as ticked: nothing hidden from
  // view gets deleted
  const pickedShown = selectOn ? shown.filter((m) => picked.has(m.id)) : [];
  const allPicked =
    pickedShown.length > 0 && pickedShown.length === shown.length;

  const toggle = (id: number) =>
    setPicked((now) => {
      const next = new Set(now);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  // Select page / Clear page: the cards on this page of the shelf
  const togglePage = (page: Manga[]) =>
    setPicked((now) => {
      const next = new Set(now);
      const ids = page.map((m) => m.id);
      const whole = ids.every((id) => now.has(id));
      for (const id of ids)
        if (whole) next.delete(id);
        else next.add(id);
      return next;
    });
  const toggleAll = () =>
    setPicked(allPicked ? new Set() : new Set(shown.map((m) => m.id)));

  const moveTo = async (to: ShelfMove) => {
    setMoveOpen(false);
    setMoving(true);
    setMoveFailed(false);
    const name = pickedShown.length === 1 ? pickedShown[0]!.name : "";
    const was = await useShelf.getState().moveMany(
      pickedShown.map((m) => m.id),
      to,
    );
    setMoving(false);
    if (!was) {
      setMoveFailed(true);
      return;
    }
    // Select stays on for the next lot
    setPicked(new Set());
    setMoved(was.length ? { to, was, name } : null);
  };
  const undoMove = async () => {
    if (!moved) return;
    const { was } = moved;
    setMoved(null);
    if (!(await useShelf.getState().placeMany(was))) setMoveFailed(true);
  };

  // the confirm dialog's Delete: true once they're gone
  const deletePicked = async () => {
    const done = await useShelf
      .getState()
      .removeMany(pickedShown.map((m) => m.id));
    if (done) {
      setConfirmingDelete(false);
      stop();
    }
    return done;
  };

  // the refs on their own: components that only read state stay plain
  const select = {
    selecting,
    selectOn,
    start: () => setSelecting(true),
    stop,
    picked,
    pickedShown,
    allPicked,
    toggle,
    togglePage,
    toggleAll,
    moveOpen,
    toggleMoveMenu: () => setMoveOpen((open) => !open),
    moving,
    moved,
    moveFailed,
    movedShowing: Boolean(moved || moveFailed),
    moveTo,
    undoMove,
    confirmingDelete,
    setConfirmingDelete,
    deletePicked,
  };
  return { select, moveMenu, movedNote };
}

export type SelectMode = ReturnType<typeof useSelectMode>["select"];
