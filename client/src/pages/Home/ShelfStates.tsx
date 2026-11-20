// What the shelf shows in place of its cards: it couldn't load, it's empty,
// nothing matches the search, the release check failed, or the check is
// still running with nothing to show yet.
import type { ReactNode } from "react";
import { NavLink } from "react-router";
import { EmptyShelfUndo } from "../../components/deletedNote/DeletedNote";
import Mascot from "../../components/mascot/Mascot";
import TakeTourButton from "../../components/tour/TakeTourButton";
import { hasBottomBar } from "../../lib/bottomBar";
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

// A new collector's first look: the ways to bring in what they own, the
// fastest first for the device (a phone scans, a laptop imports), and the
// tour for anyone not ready to start. The scan sheet opens over it
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
  const scan = (main: boolean) => (
    <li key="scan" className={styles.emptyWay}>
      <button
        type="button"
        className={`btn ${main ? "btn-primary" : "btn-secondary"} btn-lg`}
        onClick={onScan}
        onPointerEnter={onScanHover}
      >
        Scan barcodes
      </button>
      <span className={styles.emptyHint}>
        Point your camera at the back of each volume.
      </span>
    </li>
  );
  const importList = (main: boolean) => (
    <li key="import" className={styles.emptyWay}>
      <NavLink
        to="/import"
        className={`btn ${main ? "btn-primary" : "btn-secondary"} btn-lg`}
        viewTransition
      >
        Import a list
      </NavLink>
      <span className={styles.emptyHint}>
        MyAnimeList, AniList, Kitsu, Goodreads or a spreadsheet.
      </span>
    </li>
  );
  const byName = (
    <li key="add" className={styles.emptyWay}>
      <button
        type="button"
        className="btn btn-secondary btn-lg"
        onClick={onAdd}
      >
        Add by name
      </button>
      <span className={styles.emptyHint}>
        Search for a series and tick what you own.
      </span>
    </li>
  );
  // a phone has its camera to hand; a laptop has the list in another tab
  const ways = hasBottomBar()
    ? [scan(true), importList(false), byName]
    : [importList(true), byName, scan(false)];

  return (
    <section
      className={`${styles.emptyShelf} fade-in`}
      aria-labelledby="empty-shelf-title"
    >
      <EmptyShelfUndo />
      <span className="printed mascot-spot" aria-hidden>
        <Mascot mood="happy" />
      </span>
      <h2 id="empty-shelf-title" className={styles.emptyShelfTitle}>
        Start your shelf
      </h2>
      <p className={styles.emptyShelfLead}>
        Bring in the volumes you own. Pick the fastest way.
      </p>
      <ol className={styles.emptyWays}>{ways}</ol>
      <div className={styles.emptyTour}>
        <p className={styles.emptyTourAsk}>Not ready yet?</p>
        <TakeTourButton className="btn btn-ghost">
          Take the tour with Kenji
        </TakeTourButton>
        <p className={styles.emptyHint}>
          A practice shelf of 40 series. Nothing there touches your account.
        </p>
      </div>
      {children}
    </section>
  );
}

// what an empty tab says when nothing was searched for: it isn't a failed
// search, there's just nothing in it yet
const EMPTY_TAB: Record<string, string> = {
  ongoing: "Nothing you're reading yet.",
  finished: "Nothing finished yet.",
  planned: "Nothing on To read yet.",
};

export function NoMatches({
  onShowAll,
  emptyTab = null,
}: {
  onShowAll: () => void;
  // the tab that's empty with no search typed; null when a search found
  // nothing
  emptyTab?: string | null;
}) {
  const nothingYet = emptyTab ? EMPTY_TAB[emptyTab] : undefined;
  return (
    <ShelfMessage
      mood={nothingYet ? "happy" : "confused"}
      title={nothingYet ?? "No matches."}
    >
      <p className={styles.emptyBody}>
        {nothingYet
          ? "Series show up here as you mark them."
          : "Nothing on your shelf fits that. Try another word or tab."}
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
