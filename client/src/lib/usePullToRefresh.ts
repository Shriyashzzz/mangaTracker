// Android's swipe to refresh, in the app only (lib/inApp.ts): pulling down
// from the very top of the screen draws a spinner down after the finger, and
// letting go past the mark runs `refresh` (the shelf asked for again) while
// it spins. Not while a sheet or dialog is open, nor once the page is
// scrolled at all. The website keeps the browser's own pull to reload off
import { useEffect, useRef, useState } from "react";
import { inApp } from "./inApp";

// how far the spinner follows a pull, and where letting go refreshes
const MOST = 120;
const MARK = 64;
// how far the page stays down while it refreshes: room for the indicator
const HOLD = 92;
// the spinner moves at half the finger's speed, as Android's does
const DRAG = 0.5;

export function usePullToRefresh(
  refresh: () => Promise<unknown>,
  // a pull beginning: the indicator picks its look then
  onStart?: () => void,
) {
  const [pull, setPull] = useState(0);
  const [busy, setBusy] = useState(false);
  // a finger on the screen pulling: the page follows it with no easing
  const [dragging, setDragging] = useState(false);
  // the newest refresh, for listeners set up once
  const latest = useRef(refresh);
  const starting = useRef(onStart);
  useEffect(() => {
    latest.current = refresh;
    starting.current = onStart;
  });
  const running = useRef(false);

  useEffect(() => {
    if (!inApp()) return;
    let startY: number | null = null;
    let pulled = 0;
    const covered = () =>
      document.querySelector(".app-sheet, dialog[open], [role='dialog']");
    const start = (e: TouchEvent) => {
      startY =
        window.scrollY <= 0 && !running.current && !covered()
          ? (e.touches[0]?.clientY ?? null)
          : null;
      pulled = 0;
    };
    const move = (e: TouchEvent) => {
      if (startY == null) return;
      if (window.scrollY > 0) {
        startY = null;
        setDragging(false);
        setPull(0);
        return;
      }
      const was = pulled;
      pulled = Math.max(0, (e.touches[0]?.clientY ?? startY) - startY) * DRAG;
      if (was <= 0 && pulled > 0) starting.current?.();
      setDragging(pulled > 0);
      setPull(Math.min(pulled, MOST));
    };
    const end = () => {
      if (startY == null) return;
      startY = null;
      setDragging(false);
      if (pulled < MARK) return setPull(0);
      running.current = true;
      setBusy(true);
      setPull(HOLD);
      latest
        .current()
        .catch(() => {})
        .finally(() => {
          running.current = false;
          setBusy(false);
          setPull(0);
        });
    };
    window.addEventListener("touchstart", start, { passive: true });
    window.addEventListener("touchmove", move, { passive: true });
    window.addEventListener("touchend", end);
    window.addEventListener("touchcancel", end);
    return () => {
      window.removeEventListener("touchstart", start);
      window.removeEventListener("touchmove", move);
      window.removeEventListener("touchend", end);
      window.removeEventListener("touchcancel", end);
    };
  }, []);

  return { pull, busy, dragging, ready: pull >= MARK };
}
