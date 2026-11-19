// "Needs a connection", for a moment by the finger that tapped something
// greyed out offline (lib/offline.ts offlineLink). Drawn like a cover's
// caption (components/coverCaption).
import { useEffect, useState } from "react";
import { NEEDS_CONNECTION } from "../../lib/offline";

const SHOWN_MS = 1800;
// kept inside the screen: about half the note's width
const EDGE = 90;

export default function OfflineNudge() {
  const [at, setAt] = useState<{ x: number; y: number; n: number } | null>(
    null,
  );
  useEffect(() => {
    let n = 0;
    const show = (e: Event) => {
      const { x, y } = (e as CustomEvent<{ x: number; y: number }>).detail;
      setAt({ x, y, n: ++n });
    };
    window.addEventListener(NEEDS_CONNECTION, show);
    return () => window.removeEventListener(NEEDS_CONNECTION, show);
  }, []);
  useEffect(() => {
    if (!at) return;
    const gone = setTimeout(() => setAt(null), SHOWN_MS);
    return () => clearTimeout(gone);
  }, [at]);

  const left = at
    ? Math.min(Math.max(at.x, EDGE), window.innerWidth - EDGE)
    : 0;
  // above the finger, or below it at the top of the screen
  const above = at ? at.y > 60 : true;
  return (
    <p role="status">
      {at && (
        <span
          key={at.n}
          className="fade-in pointer-events-none fixed z-50 w-max border-[1.5px] border-line bg-card px-2 py-1 text-[0.8rem] leading-[1.35] font-semibold text-ink shadow-[2px_2px_0_var(--hard-shadow)]"
          style={{
            left,
            top: above ? at.y - 14 : at.y + 18,
            translate: above ? "-50% -100%" : "-50% 0",
          }}
        >
          Needs a connection
        </span>
      )}
    </p>
  );
}
