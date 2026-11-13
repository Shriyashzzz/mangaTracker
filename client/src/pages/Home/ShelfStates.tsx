// What the shelf shows in place of its cards: it couldn't load, it's empty,
// nothing matches the search, the release check failed, or the check is
// still running with nothing to show yet.
import type { ReactNode } from "react";
import { NavLink } from "react-router";
import { EmptyShelfUndo } from "../../components/deletedNote/DeletedNote";
import Mascot from "../../components/mascot/Mascot";
import { homeStyles as styles } from "./styles";

type Mood = "panic" | "happy" | "confused";

// Kenji, a title, a line or two, and one thing to do
function ShelfMessage({
  mood,
  title,
  fadeIn = false,
  children,
}: {
  mood: Mood;
  title: string;
  fadeIn?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className={fadeIn ? `${styles.emptyState} fade-in` : styles.emptyState}
    >
      <span className="printed mascot-spot" aria-hidden>
        <Mascot mood={mood} />
      </span>
      <p className={styles.emptyTitle}>{title}</p>
      {children}
    </div>
  );
}

export function ShelfUnreachable({ onRetry }: { onRetry: () => void }) {
  return (
    <ShelfMessage mood="panic" title="Couldn't reach your shelf.">
      <p className={styles.emptyBody}>
        The server didn't answer. Give it a minute, then try again.
      </p>
      <button type="button" className="btn btn-primary" onClick={onRetry}>
        Try again
      </button>
    </ShelfMessage>
  );
}

export function EmptyShelf({
  onAdd,
  onScan,
  onScanHover,
  children,
}: {
  onAdd: () => void;
  onScan: () => void;
  // on the way to a click: the scanner's code starts loading
  onScanHover: () => void;
  // the scan sheet, once it's open
  children?: ReactNode;
}) {
  return (
    <ShelfMessage mood="happy" title="Nothing on the shelf yet." fadeIn>
      <EmptyShelfUndo />
      <p className={styles.emptyBody}>
        Add whatever you're reading right now, and the chapter you're on. That's
        all it takes.
      </p>
      <button className="btn btn-primary btn-lg" onClick={onAdd}>
        Add your first manga
      </button>
      <NavLink
        to="/import"
        className={`${styles.importLink} mx-auto mt-4 block w-fit`}
        viewTransition
      >
        Or import your list
      </NavLink>
      {/* a stack of volumes by the hand: the shelf's own Scan button and the
          phone's + aren't here yet, so it's offered from the start */}
      <button
        type="button"
        className={`${styles.importLink} mx-auto mt-2 block w-fit`}
        onClick={onScan}
        onPointerEnter={onScanHover}
      >
        Or scan their barcodes
      </button>
      {children}
    </ShelfMessage>
  );
}

export function NoMatches({ onShowAll }: { onShowAll: () => void }) {
  return (
    <ShelfMessage mood="confused" title="No matches.">
      <p className={styles.emptyBody}>
        Nothing on your shelf fits that. Try another word or tab.
      </p>
      <button className="btn btn-secondary" onClick={onShowAll}>
        Show everything
      </button>
    </ShelfMessage>
  );
}

export function ChecksFailed({ onRetry }: { onRetry: () => void }) {
  return (
    <ShelfMessage mood="panic" title="Couldn't check right now.">
      <p className={styles.emptyBody}>
        The sites we ask for releases didn't answer. Give it a minute.
      </p>
      <button className="btn btn-secondary" onClick={onRetry}>
        Try again
      </button>
    </ShelfMessage>
  );
}

// the release check is running and has found nothing to show yet. A while
// in, one line (a box would look stuck); before that, the bar in the middle
// of the page, where the cards will be
export function CheckingWithNothingYet({
  early,
  waitingText,
  checked,
  total,
  bar,
  aside,
}: {
  // the check has barely started
  early: boolean;
  // "Looking for new volumes"
  waitingText: string;
  checked: number;
  total: number;
  bar: ReactNode;
  // "The first check on a big shelf can take a few minutes."
  aside: string | false;
}) {
  const asideNote = aside && <span className={styles.checkAside}>{aside}</span>;
  if (early)
    return (
      <div className={styles.checkCentre}>
        <p className={styles.checkTitle}>Checking for new releases</p>
        {bar}
        <p className={styles.checkText} aria-live="polite">
          {checked} of {total}
          {asideNote}
        </p>
      </div>
    );
  return (
    <div className={styles.checkInline}>
      {bar}
      <p className={styles.checkText} aria-live="polite">
        {waitingText} · {checked} of {total} checked
        {asideNote}
      </p>
    </div>
  );
}
