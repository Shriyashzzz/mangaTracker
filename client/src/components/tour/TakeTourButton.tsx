import type { ReactNode } from "react";
import { startDemo, type DemoKind } from "../../lib/demo";
import { useAuth } from "../../store/auth";

// starts Kenji's tour. It never starts on its own
export default function TakeTourButton({
  large = false,
  small = false,
  className,
  kind = "reader",
  children,
}: {
  // which tour: the short one, or the collector's on a big shelf
  kind?: DemoKind;
  large?: boolean;
  small?: boolean;
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
        `btn btn-secondary ${large ? "btn-lg" : small ? "btn-sm" : "upto-720:btn-lg p-3"}`
      }
      onClick={() => {
        startDemo(Boolean(isSignedIn), kind);
      }}
    >
      {children ?? "Try Interactive Demo →"}
    </button>
  );
}
