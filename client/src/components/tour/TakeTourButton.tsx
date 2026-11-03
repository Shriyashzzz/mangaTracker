import { startDemo } from "../../lib/demo";
import { useAuth } from "../../store/auth";

// starts Kenji's tour. It never starts on its own
export default function TakeTourButton({
  large = false,
  small = false,
  className,
}: {
  large?: boolean;
  small?: boolean;
  className?: string;
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
      onClick={() => startDemo(Boolean(isSignedIn))}
    >
      Try Interactive Demo →
    </button>
  );
}
