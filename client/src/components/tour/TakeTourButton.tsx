import type { ReactNode } from "react";
import { startDemo } from "../../lib/demo";
import { markTourDone } from "../../lib/tourOffer";
import { useAuth } from "../../store/auth";

// starts Kenji's tour. It never starts on its own
export default function TakeTourButton({
  large = false,
  small = false,
  shortOnPhones = false,
  className,
  children,
}: {
  large?: boolean;
  small?: boolean;
  // "Try the demo →" on phones, where the full name won't fit beside another
  shortOnPhones?: boolean;
  className?: string;
  // its own words, where "Try Interactive Demo" isn't the one
  children?: ReactNode;
}) {
  // signed in or not, anyone can take it; it remembers which to send them back to
  const isSignedIn = useAuth((s) => s.isSignedIn);
  return (
    <button
      type="button"
      className={
        className ??
        `btn btn-secondary ${large ? "btn-lg" : small ? "btn-sm" : ""}`
      }
      onClick={() => {
        // taken: Kenji needn't offer it (lib/tourOffer.ts)
        markTourDone();
        startDemo(Boolean(isSignedIn));
      }}
    >
      {children ??
        (shortOnPhones ? (
          <>
            <span className="upto-720:hidden">Try Interactive Demo →</span>
            <span className="hidden upto-720:inline">Try the demo →</span>
          </>
        ) : (
          "Try Interactive Demo →"
        ))}
    </button>
  );
}
