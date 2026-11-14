// The New tab's pieces around the cards: the Volumes / Chapters / In Japan
// switch with its links, the check's progress bar, the "Hidden: Berserk ·
// Undo" note, and what it says when there's nothing new.
import { useEffect, useState } from "react";
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
  // the one showing is filled in; one with nothing new is faded
  const kindClass = (k: ReleaseKind) => {
    if (kind === k) return styles.releaseKindActive;
    const nothingNew = showCounts && counts[k] === 0;
    return nothingNew ? styles.releaseKindEmpty : styles.releaseKind;
  };
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
            className={kindClass(k)}
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
          // only In Japan says anything: that these may not be out in English
          RELEASE_KINDS[kind].note && (
            <p className={styles.releaseNote}>{RELEASE_KINDS[kind].note}</p>
          )
        )}
      </div>
    </div>
  );
}

// Hide all asks first from this many series (fewer is quick to undo by eye)
const ASK_FROM = 10;
// how long "Tap again" waits
const ASK_MS = 4000;

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
  // Hide all takes a second tap when it would hide a lot: the first one
  // asks, for a few seconds
  const [asking, setAsking] = useState(false);
  useEffect(() => {
    if (!asking) return;
    const timer = setTimeout(() => setAsking(false), ASK_MS);
    return () => clearTimeout(timer);
  }, [asking]);
  const hideAll = () => {
    if (hideAllCount >= ASK_FROM && !asking) return setAsking(true);
    setAsking(false);
    onHideAll();
  };
  return (
    <div className={styles.releaseLinksRow}>
      <div className={styles.releaseLinks}>
        {/* a little "?" stamp, like the volume stamps, not another link */}
        <NavLink to="/new-releases" className={styles.helpLink} viewTransition>
          <span className={styles.helpMark} aria-hidden>
            ?
          </span>
          How New works
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
              Back to New
            </button>
          </>
        )}
      </div>
      {hideAllCount > 0 && !viewingHidden && (
        <button type="button" className={styles.hideAll} onClick={hideAll}>
          {asking
            ? `Hide all ${hideAllCount}? Press again`
            : `Hide all ${hideAllCount}`}
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

// how many series the release sites don't know, and so can never list
function notFoundLine(notFound: number, looked: number) {
  if (notFound === looked)
    return "We couldn't find release news for any of your series.";
  if (notFound === 1)
    return "We couldn't find release news for 1 of your series.";
  return `We couldn't find release news for ${notFound} of your series.`;
}

// "75 series are further behind than your setting shows", with the way to
// change it: under an empty list, and at the foot of a short one
export function HeldBack({ count }: { count: number }) {
  return (
    <p className={styles.emptyBody}>
      {count === 1
        ? "1 series is further behind than your setting shows. "
        : `${count} series are further behind than your setting shows. `}
      <NavLink
        to="/settings/new-releases"
        className="tap font-medium text-ink underline decoration-accent decoration-2 underline-offset-3"
        viewTransition
      >
        Change what New shows
      </NavLink>
    </p>
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
  heldBack,
  elsewhere,
  onKind,
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
  // series with something out that their setting keeps off the list
  heldBack: number;
  // another side of the switch that does have something, to offer
  elsewhere?: { kind: ReleaseKind; count: number };
  onKind: (kind: ReleaseKind) => void;
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
      {/* their own setting is why: said first, with the way to change it */}
      {heldBack > 0 && (
        <>
          <p className={styles.nothingNewTitle}>
            Nothing this close to caught up.
          </p>
          <HeldBack count={heldBack} />
        </>
      )}
      {heldBack === 0 && (
        <p className={styles.nothingNewTitle}>
          {looked > 0 && unknownPlace === looked
            ? "We don't know where you're up to yet."
            : RELEASE_KINDS[kind].emptyTitle}
        </p>
      )}
      {heldBack === 0 && unknownPlace < looked && (
        <p className={styles.emptyBody}>{RELEASE_KINDS[kind].emptyBody}</p>
      )}
      {unknownPlace > 0 && (
        <p className={styles.emptyBody}>
          {unknownPlace === looked
            ? missingNumber
            : `${unknownPlace} of your series can't show up here yet. ${missingNumber}`}
        </p>
      )}
      {/* nothing here, but there is on another side of the switch */}
      {elsewhere && (
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => onKind(elsewhere.kind)}
        >
          See {elsewhere.count} under {RELEASE_KINDS[elsewhere.kind].label}
        </button>
      )}
      {looked < total && (
        <p className={styles.emptyBody}>
          Light novels aren't checked for new releases yet.
        </p>
      )}
      {!checking && notFound > 0 && (
        <p className={styles.emptyBody}>{notFoundLine(notFound, looked)}</p>
      )}
    </div>
  );
}
