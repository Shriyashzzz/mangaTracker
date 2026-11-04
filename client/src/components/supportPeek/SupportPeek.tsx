// Kenji peeks in, once in a long while, to mention the site runs on coffee. Which
// way he comes in is picked at random each time. See lib/support.ts for when.
import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router";
import { CloseIcon } from "../icons/Icons";
import { Fingers, Head } from "../kenji/Kenji";
import {
  SUPPORT_URL,
  markPeekShown,
  readyToPeek,
  stopAsking,
} from "../../lib/support";

const SHOW_AFTER_MS = 900;
const LEAVE_AFTER_MS = 15000;
const LEAVING_MS = 260;

type Way = "edge" | "side";

export default function SupportPeek() {
  const [way, setWay] = useState<Way | null>(null);
  const [leaving, setLeaving] = useState(false);
  const { pathname } = useLocation();
  const leaveTimer = useRef<number | undefined>(undefined);

  // when they come back from the store, or move to another page
  useEffect(() => {
    if (way) return;
    let timer: number | undefined;
    const tryToPeek = () => {
      clearTimeout(timer);
      if (document.hidden || !readyToPeek()) return;
      timer = window.setTimeout(() => {
        if (document.hidden || !readyToPeek()) return;
        // not mid-typing, and not on top of another note in that corner
        const typing = document.activeElement?.matches(
          "input, textarea, select",
        );
        if (typing || document.querySelector("[data-over-add-button]")) return;
        markPeekShown();
        setWay(Math.random() < 0.5 ? "edge" : "side");
      }, SHOW_AFTER_MS);
    };
    tryToPeek();
    document.addEventListener("visibilitychange", tryToPeek);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", tryToPeek);
    };
  }, [way, pathname]);

  const leave = () => {
    clearTimeout(leaveTimer.current);
    setLeaving(true);
    window.setTimeout(() => {
      setWay(null);
      setLeaving(false);
    }, LEAVING_MS);
  };

  // left alone, he ducks away; not while they're on it or reading with a keyboard
  const waitToLeave = () => {
    clearTimeout(leaveTimer.current);
    leaveTimer.current = window.setTimeout(leave, LEAVE_AFTER_MS);
  };
  const holdOn = () => clearTimeout(leaveTimer.current);
  useEffect(() => {
    if (!way) return;
    waitToLeave();
    return holdOn;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [way]);

  if (!way) return null;

  const answered = () => {
    stopAsking();
    leave();
  };

  return (
    <div
      role="status"
      aria-label="Support Manga Tracker"
      className={`support-peek support-peek-${way} ${leaving ? "is-leaving" : ""}`}
      onMouseEnter={holdOn}
      onMouseLeave={waitToLeave}
      onFocus={holdOn}
      onBlur={waitToLeave}
    >
      <div className="printed support-peek-kenji" aria-hidden>
        {way === "edge" ? (
          // cut off below the eyes: the edge he's behind hides the rest
          <svg viewBox="0 0 126 92">
            <g className="support-peek-head">
              <Head grin={false} />
            </g>
            <g className="support-peek-hands">
              <Fingers x={2} />
              <Fingers x={89} />
            </g>
          </svg>
        ) : (
          <svg viewBox="0 0 126 122">
            <g className="support-peek-head">
              <Head grin />
            </g>
          </svg>
        )}
      </div>

      <div className="support-peek-line">
        <button
          type="button"
          className="tap support-peek-close"
          aria-label="Close"
          onClick={answered}
        >
          <CloseIcon />
        </button>
        <p>
          {way === "side" ? "Psst! Found a good deal?" : "Enjoying the site?"}
        </p>
        <p className="support-peek-more">
          {way === "side"
            ? "Maybe spend the change on my coffee?"
            : "A coffee keeps it running."}
        </p>
        <a
          href={SUPPORT_URL}
          target="_blank"
          rel="noreferrer"
          onClick={answered}
        >
          Buy me a coffee
        </a>
      </div>
    </div>
  );
}
