// Kenji peeks in on the shelf to ask a Google reader if they'd like the
// weekly email, once a device (lib/weeklyAsk.ts). "Yes, send it" switches it
// on at once: Google confirmed their address, so no link to press. The
// cross is a no for this device; left alone he asks another visit. Settings
// always has the switch. Drawn like the compact rows question (ViewPeek)
import { useEffect, useRef, useState } from "react";
import { CloseIcon } from "../icons/Icons";
import { Fingers, Head } from "../kenji/Kenji";
import { isDemo } from "../../lib/demo";
import { claimNote, noteFree } from "../../lib/notes";
import { useSwipeAway } from "../../lib/useSwipeAway";
import {
  askedOnThisDevice,
  markAsked,
  weeklyAskDue,
} from "../../lib/weeklyAsk";
import { useAccount } from "../../store/account";

const SHOW_AFTER_MS = 2000;
const LEAVING_MS = 260;
// how long he waits for an answer, and after a yes, how long he grins
const WAIT_MS = 20_000;
const THANKS_MS = 4_000;

type Props = {
  // something else is using the bottom of the screen (Select, an undo note)
  blocked: boolean;
};

export default function WeeklyEmailPeek({ blocked }: Props) {
  const account = useAccount((s) => s.account);
  const switchWeekly = useAccount((s) => s.weeklyEmail);
  const [note, setNote] = useState<"ask" | "yes" | "failed" | null>(null);
  const [leaving, setLeaving] = useState(false);
  const leaveTimer = useRef<number | undefined>(undefined);

  const canAsk = weeklyAskDue(account, askedOnThisDevice());

  useEffect(() => {
    if (note || blocked || isDemo() || !canAsk) return;
    const timer = window.setTimeout(() => {
      if (document.hidden) return;
      // not on top of another note down there, and Kenji's turn
      if (document.querySelector("[data-over-add-button], .support-peek"))
        return;
      if (!noteFree("weekly")) return;
      claimNote("weekly");
      setNote("ask");
    }, SHOW_AFTER_MS);
    return () => clearTimeout(timer);
  }, [note, blocked, canAsk]);

  const leave = () => {
    clearTimeout(leaveTimer.current);
    setLeaving(true);
    window.setTimeout(() => {
      setNote(null);
      setLeaving(false);
    }, LEAVING_MS);
  };
  const swipe = useSwipeAway(leave);
  const waitToLeave = (ms: number) => {
    clearTimeout(leaveTimer.current);
    leaveTimer.current = window.setTimeout(leave, ms);
  };
  const holdOn = () => clearTimeout(leaveTimer.current);
  useEffect(() => {
    if (note === "ask") waitToLeave(WAIT_MS);
    if (note === "yes") waitToLeave(THANKS_MS);
    return holdOn;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [note]);

  if (!note) return null;

  const yes = async () => {
    markAsked();
    try {
      await switchWeekly(true);
      setNote("yes");
    } catch {
      setNote("failed");
    }
  };

  let words = (
    <>
      <p>Want a weekly email for your shelf?</p>
      <p className="support-peek-more">
        New volumes and price drops, sent to {account?.recoveryEmail}.
      </p>
      <button type="button" onClick={yes}>
        Yes, send it
      </button>
    </>
  );
  if (note === "yes")
    words = (
      <>
        <p>You're in!</p>
        <p className="support-peek-more">
          It comes when there's news. Settings can stop it.
        </p>
      </>
    );
  if (note === "failed")
    words = (
      <>
        <p>That didn't save.</p>
        <p className="support-peek-more">Switch it on in Settings, Account.</p>
      </>
    );

  return (
    <div
      role="status"
      aria-label="Weekly email"
      data-over-add-button
      {...swipe}
      className={`support-peek ${leaving ? "is-leaving" : ""}`}
      onMouseEnter={holdOn}
      onMouseLeave={() => waitToLeave(note === "ask" ? WAIT_MS : THANKS_MS)}
    >
      <div className="printed support-peek-kenji" aria-hidden>
        <svg viewBox="0 0 126 92">
          <g className="support-peek-head">
            <Head grin={note === "yes"} />
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
          aria-label={note === "ask" ? "No thanks" : "Close"}
          onClick={() => {
            markAsked();
            leave();
          }}
        >
          <CloseIcon />
        </button>
        {words}
      </div>
    </div>
  );
}
