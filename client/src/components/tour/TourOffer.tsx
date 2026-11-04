// A new account's first look at the shelf: Kenji peeks in and offers the tour,
// once (lib/tourOffer.ts). On laptops he waits for an answer in the empty
// corner. On phones he'd cover the shelf's own buttons, so unanswered he ducks
// away after a while and asks again the next time they open the shelf. He stays
// out of the way of the import's notes; the support note keeps away from his
// (data-over-add-button)
import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router";
import { hasBottomBar } from "../../lib/bottomBar";
import { markTourDone, shouldOfferTour } from "../../lib/tourOffer";
import { useAuth } from "../../store/auth";
import { Fingers, Head } from "../kenji/Kenji";
import TakeTourButton from "./TakeTourButton";

const SHOW_AFTER_MS = 900;
const PHONE_LEAVE_AFTER_MS = 12000;
const LEAVING_MS = 260;

export default function TourOffer() {
  const { pathname } = useLocation();
  // only the shelf: "/" is the price search once they're signed in
  const onShelf = pathname === "/shelf";
  const signedIn = useAuth((s) => s.isSignedIn);
  const [shown, setShown] = useState(false);
  const [leaving, setLeaving] = useState(false);
  // ducked away unanswered on this visit to the shelf
  const [ducked, setDucked] = useState(false);
  const leaveTimer = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (shown || ducked || !signedIn || !onShelf || !shouldOfferTour()) return;
    const timer = window.setTimeout(() => {
      // not on top of another note in that corner
      if (document.querySelector("[data-over-add-button], .support-peek"))
        return;
      setShown(true);
    }, SHOW_AFTER_MS);
    return () => clearTimeout(timer);
  }, [shown, ducked, signedIn, onShelf]);

  const leave = () => {
    clearTimeout(leaveTimer.current);
    setLeaving(true);
    window.setTimeout(() => {
      setShown(false);
      setLeaving(false);
    }, LEAVING_MS);
  };

  // phones: unanswered, he ducks away; not while they're on him
  const waitToLeave = () => {
    clearTimeout(leaveTimer.current);
    if (!hasBottomBar()) return;
    leaveTimer.current = window.setTimeout(() => {
      setDucked(true);
      leave();
    }, PHONE_LEAVE_AFTER_MS);
  };
  const holdOn = () => clearTimeout(leaveTimer.current);
  useEffect(() => {
    if (!shown) return;
    waitToLeave();
    return holdOn;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shown]);

  // off the shelf: he asks again next time, if that corner's free
  if (!onShelf && (shown || ducked)) {
    setShown(false);
    setLeaving(false);
    setDucked(false);
  }
  if (!shown || !onShelf) return null;

  const notNow = () => {
    markTourDone();
    leave();
  };

  return (
    <div
      role="status"
      aria-label="Take the tour"
      data-over-add-button
      className={`support-peek tour-offer ${leaving ? "is-leaving" : ""}`}
      onFocus={holdOn}
      onBlur={waitToLeave}
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
        <p>New here?</p>
        <p className="support-peek-more">
          I can show you around on a practice shelf. It only takes a minute.
        </p>
        <div className="tour-offer-actions">
          <TakeTourButton className="tour-offer-go">
            Take the tour
          </TakeTourButton>
          <button
            type="button"
            className="tap tour-offer-skip"
            onClick={notNow}
          >
            Not now
          </button>
        </div>
      </div>
    </div>
  );
}
