// A small note for phones: your shelf can show what's newly out. It appears
// once ever, covers nothing important, blocks nothing and leaves on its own.
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { NavLink } from "react-router";
import { readLocal, writeLocal } from "../../lib/prefs";
import { CHECKED_BEFORE_KEY, openReleasesOnShelf } from "../../lib/shelf";
import { useAuth } from "../../store/auth";
import Mascot from "../mascot/Mascot";

const SEEN_KEY = "releaseTipSeen";
const SHOW_AFTER_MS = 2500;
const LEAVE_AFTER_MS = 12_000;
// wider screens have the WhatsNew list instead
const SMALL_SCREEN = "(max-width: 860px)";

type Props = {
  // false while it would be in the way, or already pointless
  enabled: boolean;
  // on the shelf itself: switch tab rather than following a link
  onCheck?: () => void;
};

export default function ReleaseTip({ enabled, onCheck }: Props) {
  const isSignedIn = useAuth((s) => s.isSignedIn);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!enabled || isSignedIn === null) return;
    if (!window.matchMedia(SMALL_SCREEN).matches) return;
    // anyone who has opened the New tab already knows about it
    if (readLocal(SEEN_KEY) || readLocal(CHECKED_BEFORE_KEY)) return;

    const timer = setTimeout(() => {
      // mid-typing is a bad moment; a later visit can try again
      if (document.activeElement?.tagName === "INPUT") return;
      writeLocal(SEEN_KEY, "yes");
      setOpen(true);
    }, SHOW_AFTER_MS);
    return () => clearTimeout(timer);
  }, [enabled, isSignedIn]);

  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => setOpen(false), LEAVE_AFTER_MS);
    return () => clearTimeout(timer);
  }, [open]);

  if (!open || !enabled) return null;

  const action =
    "py-2 text-[0.9rem] font-semibold text-ink underline decoration-accent decoration-2 underline-offset-3";

  // on <body>, because the pages' fade-in would otherwise pin "fixed" to the
  // page instead of the screen
  return createPortal(
    <div
      role="status"
      className="printed fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-30 mx-auto grid max-w-[420px] animate-card-in grid-cols-[44px_minmax(0,1fr)_auto] items-center gap-x-2 rounded-ink border-[2.5px] border-line bg-card py-1 pr-1 pl-2 text-ink shadow-[0_14px_30px_-14px_rgba(20,14,8,0.6)] motion-reduce:animate-none"
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
              setOpen(false);
            }}
          >
            Check now
          </button>
        ) : (
          <NavLink
            to={isSignedIn ? "/shelf" : "/signup"}
            className={`inline-block ${action}`}
            onClick={isSignedIn ? openReleasesOnShelf : undefined}
            viewTransition
          >
            {isSignedIn ? "Check my shelf" : "Start a shelf"}
          </NavLink>
        )}
      </div>

      <button
        type="button"
        className="grid size-11 place-items-center self-start text-ink-soft hover:text-ink"
        aria-label="Dismiss"
        onClick={() => setOpen(false)}
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
