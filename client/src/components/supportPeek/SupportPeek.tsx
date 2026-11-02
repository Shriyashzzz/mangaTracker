// Kenji peeks in, once in a long while, to mention the site runs on coffee. Which
// way he comes in is picked at random each time. See lib/support.ts for when.
import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router";
import { CloseIcon } from "../icons/Icons";
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

const skin = "fill-card stroke-line stroke-3";

// always ink on paper: `printed` keeps these colors in the dark theme too
function Head({ grin }: { grin: boolean }) {
  return (
    <g className="[stroke-linejoin:round]">
      <circle className={skin} cx="21" cy="80" r="7" />
      <circle className={skin} cx="103" cy="80" r="7" />
      <circle className={skin} cx="62" cy="72" r="42" />
      <path
        className="fill-line stroke-line stroke-2"
        transform="translate(-8 2)"
        d="M28 70C24 46 34 30 46 26L40 9l18 13 4-18 12 16 12-14 2 18 16-10-6 18c12 8 16 22 14 38l-8-12-6 8-6-14-8 10-8-12-8 10-8-12-8 12-6-10-8 14Z"
      />
      <path
        className="fill-none stroke-line stroke-5 [stroke-linecap:round]"
        d="M37 64q8-6 17-3M70 61q9-3 17 3"
      />
      {/* glancing over at what he's saying */}
      <g className="support-peek-eyes">
        <ellipse className="fill-line" cx="47" cy="77" rx="7.5" ry="9.5" />
        <ellipse className="fill-line" cx="79" cy="77" rx="7.5" ry="9.5" />
        <circle className="fill-card" cx="50.5" cy="73" r="2.8" />
        <circle className="fill-card" cx="82.5" cy="73" r="2.8" />
      </g>
      <path
        className="fill-star stroke-line stroke-[1.5]"
        d="M15 26l2.5 6.5 6.5 2.5-6.5 2.5-2.5 6.5-2.5-6.5-6.5-2.5 6.5-2.5Z"
      />
      {grin && (
        <path
          className="fill-accent stroke-line stroke-3"
          d="M50 94h26q-2 13-13 13t-13-13Z"
        />
      )}
    </g>
  );
}

function Fingers({ x }: { x: number }) {
  return [0, 11, 22].map((offset) => (
    <rect
      key={offset}
      className="fill-card stroke-line stroke-[2.5]"
      x={x + offset}
      y={offset === 11 ? 72 : 75}
      width="11"
      height="26"
      rx="5.5"
    />
  ));
}

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
        const typing = document.activeElement?.matches("input, textarea, select");
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
        <p>{way === "side" ? "Psst! Found a good deal?" : "Enjoying the site?"}</p>
        <p className="support-peek-more">
          {way === "side"
            ? "Maybe spend the change on my coffee?"
            : "A coffee keeps it running."}
        </p>
        <a href={SUPPORT_URL} target="_blank" rel="noreferrer" onClick={answered}>
          Buy me a coffee
        </a>
      </div>
    </div>
  );
}
