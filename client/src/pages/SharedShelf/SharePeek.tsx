// Kenji peeks in on a shared shelf for someone without an account, on their
// first three visits (lib/sharePeek.ts): first what the page is and that a
// series opens, then that they can start their own. Closing him settles it
import { useEffect, useRef, useState } from "react";
import { NavLink } from "react-router";
import { CloseIcon } from "../../components/icons/Icons";
import { Fingers, Head } from "../../components/kenji/Kenji";
import { claimNote, noteFree } from "../../lib/notes";
import { settleSharePeek } from "../../lib/sharePeek";

const SHOW_AFTER_MS = 1200;
const LEAVING_MS = 260;

export default function SharePeek({
  visit,
  owner,
}: {
  // which of the three visits this is
  visit: number;
  owner: string;
}) {
  const [shown, setShown] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    const list = timers.current;
    list.push(
      window.setTimeout(() => {
        // one of Kenji's notes a visit
        if (!noteFree("share")) return;
        claimNote("share");
        setShown(true);
      }, SHOW_AFTER_MS),
    );
    return () => list.forEach(clearTimeout);
  }, []);

  // just for now: the next visit has its own thing to say
  const leave = () => {
    setLeaving(true);
    timers.current.push(
      window.setTimeout(() => {
        setShown(false);
        setLeaving(false);
      }, LEAVING_MS),
    );
  };
  // for good
  const close = () => {
    settleSharePeek();
    leave();
  };

  if (!shown) return null;
  return (
    <div
      role="status"
      aria-label="A note from Kenji"
      className={`support-peek share-peek ${leaving ? "is-leaving" : ""}`}
    >
      <div className="printed support-peek-kenji" aria-hidden>
        <svg viewBox="0 0 126 92">
          <g className="support-peek-head">
            <Head grin={visit > 1} />
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
          aria-label="Close, and don't show this again"
          onClick={close}
        >
          <CloseIcon />
        </button>
        {visit === 1 ? (
          <>
            <p>This is {owner}'s shelf!</p>
            <p className="support-peek-more">
              Tap any series to see which volumes they own.
            </p>
            <div className="share-peek-ways">
              <button type="button" onClick={leave}>
                Got it
              </button>
            </div>
          </>
        ) : visit === 2 ? (
          <>
            <p>Want a shelf like this?</p>
            <p className="support-peek-more">
              Start your own and share it the same way. It's free.
            </p>
            <div className="share-peek-ways">
              <NavLink to="/signup" viewTransition onClick={close}>
                Start my shelf
              </NavLink>
            </div>
          </>
        ) : (
          <>
            <p>Your manga, sorted.</p>
            <p className="support-peek-more">
              Track what you own, what's coming out, and where it's cheapest.
            </p>
            <div className="share-peek-ways">
              <NavLink to="/signup" viewTransition onClick={close}>
                Start my shelf
              </NavLink>
              <NavLink to="/" viewTransition onClick={leave}>
                Look around
              </NavLink>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
