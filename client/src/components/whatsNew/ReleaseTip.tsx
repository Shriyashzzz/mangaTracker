// A small note for screens with no room for WhatsNew: your shelf can show what's
// newly out. Blocks nothing and leaves on its own. Shown twice at most, in case
// they weren't looking the first time; once if they answer it.
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { NavLink } from "react-router";
import { readLocal, useReleaseChecksOn, writeLocal } from "../../lib/prefs";
import { isDemo } from "../../lib/demo";
import { CHECKED_BEFORE_KEY, openReleasesOnShelf } from "../../lib/shelf";
import { useAuth } from "../../store/auth";
import Mascot from "../mascot/Mascot";

const SEEN_KEY = "releaseTipSeen";
const SHOW_AFTER_MS = 2500;
const LEAVE_AFTER_MS = 20_000;
// wider screens have room for the WhatsNew list instead
const SMALL_SCREEN = "(max-width: 1339px)";

type Props = {
  // false while it would be in the way, or already pointless
  enabled: boolean;
  // on the shelf itself: switch tab rather than following a link
  onCheck?: () => void;
};

export default function ReleaseTip({ enabled, onCheck }: Props) {
  const isSignedIn = useAuth((s) => s.isSignedIn);
  const [open, setOpen] = useState(false);
  const checksOn = useReleaseChecksOn();

  useEffect(() => {
    if (!enabled || isSignedIn === null || !checksOn || isDemo()) return;
    if (!window.matchMedia(SMALL_SCREEN).matches) return;
    // anyone who has opened the New tab already knows about it
    const seen = readLocal(SEEN_KEY);
    if (seen === "yes" || readLocal(CHECKED_BEFORE_KEY)) return;

    const timer = setTimeout(() => {
      // mid-typing is a bad moment; a later visit can try again
      const active = document.activeElement;
      if (active instanceof HTMLInputElement && active.value) return;
      // that corner's taken; a later visit can try again
      if (document.querySelector(".support-peek")) return;
      writeLocal(SEEN_KEY, seen === "once" ? "yes" : "once");
      setOpen(true);
    }, SHOW_AFTER_MS);
    return () => clearTimeout(timer);
  }, [enabled, isSignedIn, checksOn]);

  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => setOpen(false), LEAVE_AFTER_MS);
    return () => clearTimeout(timer);
  }, [open]);

  if (!open || !enabled || !checksOn) return null;

  // they've answered it, so that's the last of it
  const answered = () => {
    writeLocal(SEEN_KEY, "yes");
    setOpen(false);
  };

  const action =
    "tap py-2 text-[0.9rem] font-semibold text-ink underline decoration-accent decoration-2 underline-offset-3";

  // on <body>, because the pages' fade-in would otherwise pin "fixed" to the
  // page instead of the screen
  return createPortal(
    <div
      role="status"
      data-over-add-button
      className="printed fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-30 upto-720:bottom-[calc(4.25rem+env(safe-area-inset-bottom))] mx-auto grid max-w-[420px] min-[861px]:mr-0 animate-card-in grid-cols-[44px_minmax(0,1fr)_auto] items-center gap-x-2 rounded-ink border-[2.5px] border-line bg-card py-1 pr-1 pl-2 text-ink shadow-[0_14px_30px_-14px_rgba(20,14,8,0.6)] motion-reduce:animate-none"
    >
      <span aria-hidden>
        <Mascot mood="happy" />
      </span>

      <div className="min-w-0">
        <p className="font-letter text-[0.86rem] leading-[1.2] font-bold">
          Psst! Your shelf can spot new volumes.
        </p>
        {onCheck ? (
          <button
            type="button"
            className={action}
            onClick={() => {
              onCheck();
              answered();
            }}
          >
            Check now
          </button>
        ) : (
          <NavLink
            to={isSignedIn ? "/shelf" : "/signup"}
            className={`inline-block ${action}`}
            onClick={() => {
              if (isSignedIn) openReleasesOnShelf();
              answered();
            }}
            viewTransition
          >
            {isSignedIn ? "Check my shelf" : "Start your shelf"}
          </NavLink>
        )}
      </div>

      <button
        type="button"
        className="grid size-11 place-items-center self-start text-ink-soft hover:text-ink"
        aria-label="Dismiss"
        onClick={answered}
      >
        <svg
          viewBox="0 0 24 24"
          width="16"
          height="16"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          aria-hidden
        >
          <path d="M5 5l14 14M19 5L5 19" />
        </svg>
      </button>
    </div>,
    document.body,
  );
}
