// The end of a list that shows more as it's reached, as Android's lists
// load as you scroll: an empty line under the list that asks for the next
// batch when it comes within a screen of view. Nothing to tap, no spinner:
// what comes is already loaded
import { useEffect, useRef } from "react";

export default function GrowOnSight({ onSight }: { onSight: () => void }) {
  const spot = useRef<HTMLDivElement>(null);
  const latest = useRef(onSight);
  useEffect(() => {
    latest.current = onSight;
  });
  useEffect(() => {
    const el = spot.current;
    if (!el) return;
    const watch = new IntersectionObserver(
      (seen) => {
        // in view, or already passed by a fast fling or a jump to the bottom
        if (seen.some((s) => s.isIntersecting || s.boundingClientRect.top < 0))
          latest.current();
      },
      { rootMargin: "0px 0px 100% 0px" },
    );
    watch.observe(el);
    return () => watch.disconnect();
  }, []);
  return <div ref={spot} aria-hidden className="h-px" />;
}
