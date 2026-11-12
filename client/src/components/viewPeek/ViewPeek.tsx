// Kenji peeks in on the shelf to ask someone on big covers if they'd like to try
// compact rows. Trying it switches at once, and he stays a moment in case they'd
// rather switch back. See lib/viewPeek.ts for when he asks.
import { useEffect, useRef, useState } from "react";
import { CloseIcon } from "../icons/Icons";
import { Fingers, Head } from "../kenji/Kenji";
import { isDemo } from "../../lib/demo";
import { claimNote, noteFree } from "../../lib/notes";
import { readLocal, writeLocal } from "../../lib/prefs";
import { hasBottomBar } from "../../lib/bottomBar";
import {
  VIEW_PEEK_KEY,
  VIEW_PEEK_LEAVE_MS,
  canAskAboutView,
  readViewPeek,
  type ViewPeekState,
} from "../../lib/viewPeek";

const SHOW_AFTER_MS = 2000;
const LEAVING_MS = 260;

type Props = {
  // how many series are on the shelf
  series: number;
  // they're on compact rows already
  rows: boolean;
  // something else is using the bottom of the screen (Select, an undo note)
  blocked: boolean;
  onChoose: (view: "rows" | "covers") => void;
};

const save = (patch: ViewPeekState) =>
  writeLocal(
    VIEW_PEEK_KEY,
    JSON.stringify({ ...readViewPeek(readLocal(VIEW_PEEK_KEY)), ...patch }),
  );

export default function ViewPeek({ series, rows, blocked, onChoose }: Props) {
  const [note, setNote] = useState<"ask" | "tried" | null>(null);
  const [leaving, setLeaving] = useState(false);
  const leaveTimer = useRef<number | undefined>(undefined);

  // a moment after the shelf has drawn, if it's time to ask
  useEffect(() => {
    // never on phones: rows are already theirs there, unless they chose covers
    if (note || blocked || isDemo() || hasBottomBar()) return;
    const timer = window.setTimeout(() => {
      const state = readViewPeek(readLocal(VIEW_PEEK_KEY));
      if (!canAskAboutView(state, { series, rows, now: Date.now() })) return;
      // not mid-typing, and not on top of another note down there
      const typing = document.activeElement?.matches("input, textarea, select");
      if (document.hidden || typing) return;
      if (document.querySelector("[data-over-add-button], .support-peek"))
        return;
      // the tour first, and one note a visit
      if (!noteFree("view")) return;
      claimNote("view");
      save({ lastShownAt: Date.now() });
      setNote("ask");
    }, SHOW_AFTER_MS);
    return () => clearTimeout(timer);
  }, [note, blocked, series, rows]);

  const leave = () => {
    clearTimeout(leaveTimer.current);
    setLeaving(true);
    window.setTimeout(() => {
      setNote(null);
      setLeaving(false);
    }, LEAVING_MS);
  };

  // left alone, he ducks away (and asks again another day); not while they're
  // on him or reading with a keyboard
  const waitToLeave = () => {
    clearTimeout(leaveTimer.current);
    leaveTimer.current = window.setTimeout(leave, VIEW_PEEK_LEAVE_MS);
  };
  const holdOn = () => clearTimeout(leaveTimer.current);
  useEffect(() => {
    if (!note) return;
    waitToLeave();
    return holdOn;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [note]);

  // Select or an undo note wants the spot: he makes way (and, not having
  // been answered, asks again another day)
  if (blocked && note) setNote(null);

  // they switched to rows some other way (the sort menu, Settings): asked
  // and answered
  if (!note || (note === "ask" && rows)) return null;

  const close = () => {
    save({ done: true });
    leave();
  };
  const tryRows = () => {
    save({ done: true });
    onChoose("rows");
    setNote("tried");
  };
  const switchBack = () => {
    onChoose("covers");
    leave();
  };

  return (
    <div
      role="status"
      aria-label="Try compact rows"
      data-over-add-button
      className={`support-peek view-peek ${leaving ? "is-leaving" : ""}`}
      onMouseEnter={holdOn}
      onMouseLeave={waitToLeave}
      onFocus={holdOn}
      onBlur={waitToLeave}
    >
      <div className="printed support-peek-kenji" aria-hidden>
        <svg viewBox="0 0 126 92">
          <g className="support-peek-head">
            <Head grin={note === "tried"} />
          </g>
          <g className="support-peek-hands">
            <Fingers x={2} />
            <Fingers x={89} />
          </g>
        </svg>
      </div>

      <div className="support-peek-line">
        <button
          type="button"
          className="tap support-peek-close"
          aria-label="Close"
          onClick={note === "ask" ? close : leave}
        >
          <CloseIcon />
        </button>
        {note === "ask" ? (
          <>
            <p>Want to try compact rows?</p>
            <p className="support-peek-more">
              More of your shelf fits on one screen.
            </p>
            <button type="button" onClick={tryRows}>
              Try compact
            </button>
          </>
        ) : (
          <>
            <p>Here it is!</p>
            <p className="support-peek-more">
              Not for you? It's in Settings too.
            </p>
            <button type="button" onClick={switchBack}>
              Switch back
            </button>
          </>
        )}
      </div>
    </div>
  );
}
