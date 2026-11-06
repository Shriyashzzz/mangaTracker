// Select's bar, pinned to the bottom of the screen so it's there however far
// down they are: how many are ticked, Select page / Select all, Move to,
// Delete and Done. The "Moved 12 series to Finished · Undo" note sits above
// it while selecting, and where the Deleted note goes otherwise (MovedNote).
// Both in portals: the page's fade-in would otherwise pin them to the page.
import type { RefObject } from "react";
import { createPortal } from "react-dom";
import { ChevronDownIcon, CloseIcon } from "../../components/icons/Icons";
import type { Manga } from "../../lib/types";
import { MOVE_LABELS, SHELF_PAGE_SIZE } from "./shelfViews";
import type { SelectMode } from "./useSelectMode";
import { homeStyles as styles } from "./styles";

// what the moved note says
function MovedLine({ select }: { select: SelectMode }) {
  if (select.moveFailed) return <>That didn't save. Try again.</>;
  if (!select.moved) return null;
  const { name, was, to } = select.moved;
  return (
    <>
      <span className={styles.seenName}>
        Moved {name || `${was.length} series`} to {MOVE_LABELS[to]}
      </span>
      <button
        type="button"
        className={styles.seenUndo}
        onClick={select.undoMove}
      >
        Undo
      </button>
    </>
  );
}

// the moved note on its own, once Select is off
export function MovedNote({
  select,
  noteRef,
}: {
  select: SelectMode;
  noteRef: RefObject<HTMLDivElement | null>;
}) {
  return createPortal(
    <div role="status" ref={noteRef}>
      {select.movedShowing && (
        <div className={styles.seenNote} data-over-add-button>
          <MovedLine select={select} />
        </div>
      )}
    </div>,
    document.body,
  );
}

export default function SelectDock({
  select,
  shown,
  page,
  tab,
  raised,
  noteRef,
  menuRef,
}: {
  select: SelectMode;
  // the moved note (useLingeringNote) and the Move to menu (closes on a tap outside)
  noteRef: RefObject<HTMLDivElement | null>;
  menuRef: RefObject<HTMLDivElement | null>;
  // everything the view shows, and this page of it
  shown: Manga[];
  page: Manga[];
  // the tab they're on: moving there does nothing, so it's off in the menu
  tab: string;
  // the "Deleted · Undo" note is up: the bar sits above it
  raised: boolean;
}) {
  const count = select.pickedShown.length;
  return createPortal(
    <div
      className={`${styles.selectDock}${raised ? ` ${styles.selectBarRaised}` : ""}`}
      data-over-add-button
    >
      <div role="status" ref={noteRef}>
        {select.movedShowing && (
          <div className={styles.dockNote}>
            <MovedLine select={select} />
          </div>
        )}
      </div>
      <div
        className={styles.selectBar}
        role="region"
        aria-label="Selected series"
      >
        <div className={styles.selectGroup}>
          <span className={styles.selectCount} role="status">
            {count}
            <span className="[@media(max-width:360px)]:sr-only"> selected</span>
          </span>
          {/* only with more than one page: otherwise it's Select all */}
          {shown.length > SHELF_PAGE_SIZE && (
            <button
              type="button"
              className={styles.selectLink}
              onClick={() => select.togglePage(page)}
            >
              {page.every((m) => select.picked.has(m.id))
                ? "Clear page"
                : "Select page"}
            </button>
          )}
          <button
            type="button"
            className={styles.selectLink}
            onClick={select.toggleAll}
          >
            {select.allPicked ? "Clear" : `Select all ${shown.length}`}
          </button>
        </div>
        <div className={styles.selectActions}>
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              className={styles.selectMove}
              disabled={!count || select.moving}
              aria-haspopup="menu"
              aria-expanded={select.moveOpen}
              onClick={select.toggleMoveMenu}
            >
              {select.moving ? "Moving…" : "Move to"}
              <ChevronDownIcon className="size-4" />
            </button>
            {select.moveOpen && (
              <div className={styles.moveMenu} role="menu">
                {(["finished", "planned", "reading"] as const).map((to) => (
                  <button
                    key={to}
                    type="button"
                    role="menuitem"
                    className={styles.moveItem}
                    // the tab they're on already is where these are
                    disabled={tab === (to === "reading" ? "ongoing" : to)}
                    onClick={() => select.moveTo(to)}
                  >
                    {MOVE_LABELS[to]}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button
            type="button"
            className={styles.selectDelete}
            disabled={!count}
            onClick={() => select.setConfirmingDelete(true)}
          >
            {/* one piece, so the button's gap doesn't split it; phones
                show "Delete 2", so the bar stays short */}
            <span>
              Delete {count || ""}
              <span className="upto-520:sr-only"> series</span>
            </span>
          </button>
          <button
            type="button"
            className={styles.selectDone}
            onClick={select.stop}
            aria-label="Done selecting"
          >
            <span className="upto-520:hidden">Done</span>
            <CloseIcon className="hidden size-5 upto-520:block" />
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
