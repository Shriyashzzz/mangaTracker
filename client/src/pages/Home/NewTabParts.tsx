// The New tab's pieces around the cards: the Volumes / Chapters / In Japan
// switch with its links, the check's progress bar, the "Hidden: Berserk ·
// Undo" note, and what it says when there's nothing new.
import { createPortal } from "react-dom";
import { NavLink } from "react-router";
import Mascot from "../../components/mascot/Mascot";
import { RELEASE_KINDS, type ReleaseKind } from "./shelfViews";
import type { Hidden } from "./useHideActions";
import { homeStyles as styles } from "./styles";

// the switch between what's new in English, chapters and Japan, and what
// the view is about
export function ReleaseTools({
  kind,
  onKind,
  counts,
  showCounts,
  viewingHidden,
  hiddenCount,
}: {
  kind: ReleaseKind;
  onKind: (kind: ReleaseKind) => void;
  counts: Record<ReleaseKind, number>;
  // not when every check failed: zeros would read as "nothing's out"
  showCounts: boolean;
  viewingHidden: boolean;
  hiddenCount: number;
}) {
  return (
    <div className={styles.releaseTools}>
      <div
        className={styles.releaseKinds}
        role="group"
        aria-label="Kind of release"
      >
        {(Object.keys(RELEASE_KINDS) as ReleaseKind[]).map((k) => (
          <button
            key={k}
            className={
              kind === k ? styles.releaseKindActive : styles.releaseKind
            }
            aria-pressed={kind === k}
            onClick={() => onKind(k)}
          >
            {RELEASE_KINDS[k].label}{" "}
            {showCounts && (
              <span className={styles.releaseKindCount}>{counts[k]}</span>
            )}
          </button>
        ))}
      </div>
      <div className={styles.releaseAside}>
        {viewingHidden ? (
          <h2 className={styles.hiddenHeading}>Hidden ({hiddenCount})</h2>
        ) : (
          <p className={styles.releaseNote}>{RELEASE_KINDS[kind].note}</p>
        )}
      </div>
    </div>
  );
}

// the row above the cards: how this works and the hidden list (or, on it,
// Unhide all and the way back) at the left, Hide all at the right
export function ReleaseLinks({
  viewingHidden,
  hiddenCount,
  onOpenHidden,
  onUnhideAll,
  onBack,
  hideAllCount,
  onHideAll,
}: {
  viewingHidden: boolean;
  hiddenCount: number;
  onOpenHidden: () => void;
  onUnhideAll: () => void;
  onBack: () => void;
  // how many Hide all would hide; nothing to hide, no button
  hideAllCount: number;
  onHideAll: () => void;
}) {
  return (
    <div className={styles.releaseLinksRow}>
      <div className={styles.releaseLinks}>
        <NavLink
          to="/new-releases"
          className={styles.hiddenToggle}
          viewTransition
        >
          How this works
        </NavLink>
        {hiddenCount > 0 && !viewingHidden && (
          <button
            type="button"
            className={styles.hiddenToggle}
            onClick={onOpenHidden}
          >
            Hidden ({hiddenCount})
          </button>
        )}
        {viewingHidden && (
          <>
            <button
              type="button"
              className={styles.hiddenToggle}
              onClick={onUnhideAll}
            >
              Unhide all
            </button>
            {/* back to what's new, without a stop here on the way back */}
            <button
              type="button"
              className={styles.hiddenToggle}
              onClick={onBack}
            >
              Back to new
            </button>
          </>
        )}
      </div>
      {hideAllCount > 0 && !viewingHidden && (
        <button
          type="button"
          className={styles.hiddenToggle}
          onClick={onHideAll}
        >
          Hide all {hideAllCount}
        </button>
      )}
    </div>
  );
}

// the check's progress: something to glance at, never the point of the page
export function CheckBar({
  checked,
  total,
}: {
  checked: number;
  total: number;
}) {
  return (
    <div
      className={styles.checkBar}
      role="progressbar"
      aria-label="Checking for new releases"
      aria-valuemin={0}
      aria-valuemax={total}
      aria-valuenow={checked}
    >
      <div
        className={styles.checkBarFill}
        style={{ width: `${(checked / total) * 100}%` }}
      />
    </div>
  );
}

// "Hidden: Berserk · Undo", pinned to the screen, since "Hide" is usually
// tapped far down the list. In a portal: the page's fade-in would otherwise
// pin it to the page
export function HiddenNote({
  show,
  hidden,
  failed,
  noteRef,
  onUndo,
}: {
  show: boolean;
  hidden: Hidden | null;
  failed: boolean;
  noteRef: React.RefObject<HTMLDivElement | null>;
  onUndo: () => void;
}) {
  return createPortal(
    <div role="status" ref={noteRef}>
      {show && (hidden || failed) && (
        <div className={styles.seenNote} data-over-add-button>
          {failed ? (
            "That didn't save. Try again."
          ) : (
            <>
              <span className={styles.seenName}>
                {hidden?.restored ? "Back on the list" : "Hidden"}:{" "}
                {hidden?.name}
              </span>
              <button
                type="button"
                className={styles.seenUndo}
                onClick={onUndo}
              >
                Undo
              </button>
            </>
          )}
        </div>
      )}
    </div>,
    document.body,
  );
}

// nothing new on this side of the switch, and why some series can't show up
export function NothingNew({
  kind,
  looked,
  total,
  unknownPlace,
  notFound,
  checking,
}: {
  kind: ReleaseKind;
  // the series this side can say anything about (light novels: volumes only)
  looked: number;
  total: number;
  // with no saved place, so never "caught up" and never listed
  unknownPlace: number;
  // the release sites don't know them
  notFound: number;
  checking: boolean;
}) {
  const missingNumber =
    kind === "chapters"
      ? "Add the chapter you're on and we'll tell you when the next one's out."
      : "Add the volumes you own and we'll tell you when the next one's out.";
  return (
    <div className={styles.nothingNew} data-tour="shelf">
      <span className="printed mascot-spot" aria-hidden>
        <Mascot mood="happy" />
      </span>
      <p className={styles.nothingNewTitle}>
        {looked > 0 && unknownPlace === looked
          ? "We don't know where you're up to yet."
          : RELEASE_KINDS[kind].emptyTitle}
      </p>
      {unknownPlace < looked && (
        <p className={styles.emptyBody}>{RELEASE_KINDS[kind].emptyBody}</p>
      )}
      {unknownPlace > 0 && (
        <p className={styles.emptyBody}>
          {unknownPlace === looked
            ? missingNumber
            : `${unknownPlace} of your series can't show up here yet. ${missingNumber}`}
        </p>
      )}
      {looked < total && (
        <p className={styles.emptyBody}>
          Light novels aren't checked for new releases yet.
        </p>
      )}
      {!checking && notFound > 0 && (
        <p className={styles.emptyBody}>
          {notFound === looked
            ? "None of your series were found on the release sites, so nothing can show up here."
            : notFound === 1
              ? "1 of your series wasn't found on the release sites, so it won't show up here."
              : `${notFound} of your series weren't found on the release sites, so they won't show up here.`}
        </p>
      )}
    </div>
  );
}
