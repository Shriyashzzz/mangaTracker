// Kenji asks in the Play app whether to send alerts on this phone: a volume
// out on the day it's out, and To buy price drops (lib/alerts.ts). Android
// asks its own "Allow notifications?" after "Yes, notify me", so the reader
// knows why before Android does. Once there's a series on the shelf, and
// never again after Settings says off (lib/alertsAsk.ts). Where Android
// already lets the app notify (Android 12 and earlier), alerts go on
// without a question. Drawn like the weekly email question
// (WeeklyEmailPeek), and one note a visit (lib/notes.ts)
import { useEffect, useRef, useState } from "react";
import { CloseIcon } from "../icons/Icons";
import { Fingers, Head } from "../kenji/Kenji";
import { alertsWay, switchAlertsOn } from "../../lib/alerts";
import {
  alertsAskDue,
  choseAlertsOff,
  markAlertsAsked,
} from "../../lib/alertsAsk";
import { isDemo } from "../../lib/demo";
import { claimNote, noteFree } from "../../lib/notes";
import { appCan, askApp, inPlayApp } from "../../lib/playApp";
import { useSwipeAway } from "../../lib/useSwipeAway";

const SHOW_AFTER_MS = 2500;
const LEAVING_MS = 260;
const WAIT_MS = 20_000;
const SAID_MS = 4_500;

type Props = {
  // a series on the shelf: alerts mean something then
  hasSeries: boolean;
  // something else is using the bottom of the screen (Select, an undo note)
  blocked: boolean;
};

type Note = "ask" | "on" | "blocked" | "failed";

export default function AlertsPeek({ hasSeries, blocked }: Props) {
  const [note, setNote] = useState<Note | null>(null);
  const [leaving, setLeaving] = useState(false);
  const leaveTimer = useRef<number | undefined>(undefined);
  // worked out once a page load: whether to ask at all
  const decided = useRef(false);
  const [due, setDue] = useState(false);

  useEffect(() => {
    if (decided.current || !hasSeries) return;
    if (!inPlayApp() || isDemo() || !("Notification" in window)) return;
    decided.current = true;
    void alertsWay().then(async (way) => {
      if (way !== "off" || choseAlertsOff()) return;
      // Android lets the app notify already: on, no question
      if (Notification.permission === "granted") {
        await switchAlertsOn();
        return;
      }
      if (Notification.permission === "default" && alertsAskDue()) setDue(true);
    });
  }, [hasSeries]);

  // shown once the bottom of the screen is free, and it's Kenji's turn
  useEffect(() => {
    if (!due || note || blocked) return;
    const timer = window.setTimeout(() => {
      if (document.hidden) return;
      if (document.querySelector("[data-over-add-button], .support-peek"))
        return;
      if (!noteFree("alerts")) return;
      claimNote("alerts");
      setNote("ask");
    }, SHOW_AFTER_MS);
    return () => clearTimeout(timer);
  }, [due, note, blocked]);

  const leave = () => {
    clearTimeout(leaveTimer.current);
    setLeaving(true);
    window.setTimeout(() => {
      setNote(null);
      setLeaving(false);
    }, LEAVING_MS);
  };
  const swipe = useSwipeAway(() => {
    markAlertsAsked();
    leave();
  });
  const waitToLeave = (ms: number) => {
    clearTimeout(leaveTimer.current);
    leaveTimer.current = window.setTimeout(leave, ms);
  };
  const holdOn = () => clearTimeout(leaveTimer.current);
  useEffect(() => {
    if (note === "ask" || note === "blocked") waitToLeave(WAIT_MS);
    else if (note) waitToLeave(SAID_MS);
    return holdOn;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [note]);

  // back from Android's question or its settings: allowed now means on
  useEffect(() => {
    if (note !== "blocked") return;
    const check = async () => {
      if (document.hidden || Notification.permission !== "granted") return;
      if ((await switchAlertsOn()) === "on") setNote("on");
    };
    document.addEventListener("visibilitychange", check);
    window.addEventListener("focus", check);
    return () => {
      document.removeEventListener("visibilitychange", check);
      window.removeEventListener("focus", check);
    };
  }, [note]);

  if (!note) return null;

  const yes = async () => {
    markAlertsAsked();
    const now = await switchAlertsOn();
    if (now === "on") setNote("on");
    else if (now === "blocked") setNote("blocked");
    else if (now === "failed") setNote("failed");
    // Android's question closed without an answer: nothing to say
    else leave();
  };

  let words = (
    <>
      <p>Get notified when your next volume is out?</p>
      <p className="support-peek-more">
        We'll also tell you when a book on your To buy list gets cheaper.
      </p>
      <button type="button" onClick={yes}>
        Yes, notify me
      </button>
    </>
  );
  if (note === "on")
    words = (
      <>
        <p>You're set!</p>
        <p className="support-peek-more">
          You can turn them off in Settings anytime.
        </p>
      </>
    );
  if (note === "blocked")
    words = (
      <>
        <p>Notifications are off for Manga Tracker.</p>
        {appCan("notifications") ? (
          // the app shows Android's question, or its notification switch
          <button type="button" onClick={() => askApp("notifications")}>
            Turn on notifications
          </button>
        ) : (
          <p className="support-peek-more">
            Turn them on in your phone's Settings › Apps › Manga Tracker.
          </p>
        )}
      </>
    );
  if (note === "failed")
    words = (
      <>
        <p>That didn't work.</p>
        <p className="support-peek-more">Try again in Settings › Alerts.</p>
      </>
    );

  return (
    <div
      role="status"
      aria-label="Alerts"
      data-over-add-button
      {...swipe}
      className={`support-peek ${leaving ? "is-leaving" : ""}`}
      onMouseEnter={holdOn}
      onMouseLeave={() => waitToLeave(note === "ask" ? WAIT_MS : SAID_MS)}
    >
      <div className="printed support-peek-kenji" aria-hidden>
        <svg viewBox="0 0 126 92">
          <g className="support-peek-head">
            <Head grin={note === "on"} />
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
          aria-label={note === "ask" ? "Not now" : "Close"}
          onClick={() => {
            markAlertsAsked();
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
