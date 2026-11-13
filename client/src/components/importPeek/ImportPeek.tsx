// A book import keeps going while they look around the site (store/bookImport).
// On the import page, when matching will take a while, Kenji peeks in to say
// they needn't wait there. Away from it, a small badge says it's going; closing
// it, Kenji promises to say when it's done, and when it is, he peeks in to tell
// them.
import { useEffect, useRef, useState } from "react";
import { NavLink, useLocation } from "react-router";
import { useAuth } from "../../store/auth";
import { matchingTimeLeftMs, useBookImport } from "../../store/bookImport";
import { CloseIcon } from "../icons/Icons";
import { Fingers, Head } from "../kenji/Kenji";

const AWAY_NOTE_MS = 6000;
// on the import page: a moment after matching starts, for a while
const CAN_LEAVE_AFTER_MS = 3000;
const CAN_LEAVE_FOR_MS = 10000;
// worth saying only when it'll take longer than this
const LONG_MATCHING_MS = 60_000;
const LEAVING_MS = 260;

type Phase = "matching" | "adding" | "matched" | "added";
type Note = "canLeave" | "away" | "matched" | "added";

const series = (n: number) => `${n} series`;

// where the import is up to
function phaseOf(s: ReturnType<typeof useBookImport.getState>): Phase | null {
  if (!s.found) return null;
  if (s.finished) return "added";
  if (s.progress !== null) return "adding";
  const stillMatching = s.found.some((x) => !s.matches.has(x.key));
  return stillMatching ? "matching" : "matched";
}

// an open book with a page turning over its spine
function BookIcon() {
  return (
    <svg className="import-badge-book" viewBox="0 0 24 24" aria-hidden>
      <path d="M3 5.5c2.6-1.1 6-1.1 9 1 3-2.1 6.4-2.1 9-1V19c-2.6-1.1-6-1.1-9 1-3-2.1-6.4-2.1-9-1Z" />
      <path d="M12 6.5V20" />
      <path
        className="import-badge-page"
        d="M12 6.5c2-1.4 4.3-1.8 6.5-1.4V17c-2.2-.4-4.5 0-6.5 1.4"
      />
    </svg>
  );
}

export default function ImportPeek() {
  const { pathname } = useLocation();
  const onImportPage = pathname.startsWith("/import");
  const { found, matches, progress, adding, totals } = useBookImport();
  // closed for this import; a new file brings the badge back
  const [hiddenFor, setHiddenFor] = useState<typeof found>(null);
  const hidden = Boolean(found) && hiddenFor === found;
  const [shownNote, setNote] = useState<Note | null>(null);
  const [leaving, setLeaving] = useState(false);
  const signedIn = useAuth((s) => s.isSignedIn);

  // an import they'd started before a reload carries on, whichever page this is
  useEffect(() => {
    if (signedIn) useBookImport.getState().resume();
  }, [signedIn]);
  const timers = useRef<number[]>([]);

  const phase = phaseOf(useBookImport());
  const checked = found ? found.filter((s) => matches.has(s.key)).length : 0;

  // done while they were elsewhere: Kenji says so
  const away = useRef(!onImportPage);
  useEffect(() => {
    away.current = !onImportPage;
  }, [onImportPage]);
  useEffect(
    () =>
      useBookImport.subscribe((now, before) => {
        const [was, is] = [phaseOf(before), phaseOf(now)];
        if (!away.current || was === is) return;
        if (was === "matching" && is === "matched") setNote("matched");
        if (was === "adding" && is === "added") setNote("added");
      }),
    [],
  );

  // the import page shows it all, so there's nothing left to tell them; and
  // what Kenji says there is about that page
  const [wasOnImportPage, setWasOnImportPage] = useState(onImportPage);
  if (wasOnImportPage !== onImportPage) {
    setWasOnImportPage(onImportPage);
    if (onImportPage || shownNote === "canLeave") setNote(null);
  }

  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  const later = (ms: number, then: () => void) =>
    timers.current.push(window.setTimeout(then, ms));

  const leave = () => {
    setLeaving(true);
    later(LEAVING_MS, () => {
      setNote(null);
      setLeaving(false);
    });
  };

  // a long match on the import page: they needn't sit and watch it. Once per import
  const toldFor = useRef<typeof found>(null);
  useEffect(() => {
    if (!onImportPage || phase !== "matching" || toldFor.current === found)
      return;
    const timer = window.setTimeout(() => {
      const s = useBookImport.getState();
      const left = s.found?.filter((x) => !s.matches.has(x.key)).length ?? 0;
      if (matchingTimeLeftMs(left) < LONG_MATCHING_MS) return;
      toldFor.current = s.found;
      setNote("canLeave");
      later(CAN_LEAVE_FOR_MS, leave);
    }, CAN_LEAVE_AFTER_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onImportPage, phase, found]);

  const closeBadge = () => {
    setHiddenFor(found);
    setNote("away");
    later(AWAY_NOTE_MS, leave);
  };

  // stopped, or done matching: "it keeps going" isn't true any more
  const note =
    shownNote === "canLeave" && phase !== "matching" ? null : shownNote;
  if (onImportPage && note !== "canLeave") return null;

  if (note) {
    const done = note === "matched" || note === "added" || note === "canLeave";
    return (
      <div
        role="status"
        aria-label="Your import"
        data-over-add-button
        className={`support-peek import-peek ${leaving ? "is-leaving" : ""}`}
      >
        <div className="printed support-peek-kenji" aria-hidden>
          <svg viewBox="0 0 126 92">
            <g className="support-peek-head">
              <Head grin={false} />
            </g>
            <g className="support-peek-hands">
              <Fingers x={2} />
              <Fingers x={89} />
            </g>
          </svg>
        </div>
        <div className="support-peek-line">
          {done && (
            <button
              type="button"
              className="tap support-peek-close"
              aria-label="Close"
              onClick={leave}
            >
              <CloseIcon />
            </button>
          )}
          {note === "canLeave" ? (
            <>
              <p>This takes a while!</p>
              <p className="support-peek-more">
                Feel free to look around, it keeps going in the background.
              </p>
            </>
          ) : note === "away" ? (
            <>
              <p>On it!</p>
              <p className="support-peek-more">
                Your library is being imported in the background. I'll let you
                know when it's done!
              </p>
            </>
          ) : note === "matched" ? (
            <>
              <p>All matched!</p>
              <p className="support-peek-more">Your library's ready to add.</p>
              {/* straight to the list, not the top of the page */}
              <NavLink to="/import#import-found" viewTransition onClick={leave}>
                Review and add
              </NavLink>
            </>
          ) : (
            <>
              <p>All done!</p>
              <p className="support-peek-more">
                {totals?.added
                  ? `${series(totals.added)} added to your shelf.`
                  : "It was all on your shelf already."}
              </p>
              <NavLink to="/shelf" viewTransition onClick={leave}>
                Go to my shelf
              </NavLink>
            </>
          )}
        </div>
      </div>
    );
  }

  if (hidden || (phase !== "matching" && phase !== "adding")) return null;

  const [done, of] =
    phase === "adding" ? [progress ?? 0, adding] : [checked, found!.length];
  return (
    <div className="import-badge" data-over-add-button>
      <NavLink
        to="/import"
        viewTransition
        className="import-badge-link"
        aria-label={`Importing your library: ${done} of ${of} ${phase === "adding" ? "added" : "matched"}. Open the import`}
      >
        <BookIcon />
        <span className="import-badge-text">
          {phase === "adding" ? "Adding…" : "Importing…"}
          <span className="import-badge-count">
            {done} / {of}
          </span>
        </span>
      </NavLink>
      <button
        type="button"
        className="tap import-badge-close"
        aria-label="Hide, and carry on in the background"
        onClick={closeBadge}
      >
        <CloseIcon />
      </button>
    </div>
  );
}
