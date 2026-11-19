// "Needs a connection", for a moment just above the control that was tapped
// while offline (lib/offline.ts offlineLink), centred on it and kept inside
// the screen. Drawn like a cover's caption (components/coverCaption).
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { NEEDS_CONNECTION } from "../../lib/offline";

const SHOWN_MS = 1800;
// room kept from the screen's edges, and from the control
const MARGIN = 8;
const GAP = 8;

type Box = { left: number; width: number; top: number; bottom: number };

export default function OfflineNudge() {
  const [box, setBox] = useState<(Box & { n: number }) | null>(null);
  const note = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    let n = 0;
    const show = (e: Event) => {
      const { left, width, top, bottom } = (e as CustomEvent<DOMRect>).detail;
      setBox({ left, width, top, bottom, n: ++n });
    };
    window.addEventListener(NEEDS_CONNECTION, show);
    return () => window.removeEventListener(NEEDS_CONNECTION, show);
  }, []);
  useEffect(() => {
    if (!box) return;
    const gone = setTimeout(() => setBox(null), SHOWN_MS);
    return () => clearTimeout(gone);
  }, [box]);

  // placed once its own size is known: centred over the control, moved in
  // only as far as the screen's edge needs, below it at the top of the screen
  useLayoutEffect(() => {
    const el = note.current;
    if (!box || !el) return;
    const { width, height } = el.getBoundingClientRect();
    const centre = box.left + box.width / 2;
    const left = Math.min(
      Math.max(centre - width / 2, MARGIN),
      window.innerWidth - width - MARGIN,
    );
    const above = box.top - height - GAP;
    el.style.left = `${left}px`;
    el.style.top = `${above >= MARGIN ? above : box.bottom + GAP}px`;
    el.style.visibility = "visible";
  }, [box]);

  return (
    <p role="status">
      {box && (
        <span
          key={box.n}
          ref={note}
          className="fade-in pointer-events-none invisible fixed top-0 left-0 z-50 w-max border-[1.5px] border-line bg-card px-2 py-1 text-[0.8rem] leading-[1.35] font-semibold text-ink shadow-[2px_2px_0_var(--hard-shadow)]"
        >
          Needs a connection
        </span>
      )}
    </p>
  );
}
