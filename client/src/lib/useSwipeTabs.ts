// Swiping left or right across the shelf moves to the next or previous tab
// (All, Reading, Finished…), as tabs do in Android's own apps. In the app
// only (lib/inApp.ts), and never when the finger starts on something that
// moves sideways itself (a row of chips, a slider, a field, the shelf of
// spines a slide ticks: the Volumes tab has one), on an open sheet, or at
// the screen's edge, where Android's own Back swipe is
import { useEffect, useRef } from "react";
import { inApp } from "./inApp";
import { tick } from "./haptics";

// how far, how level and how quick a swipe is
const MIN_PX = 70;
const LEVEL = 2;
const MAX_MS = 600;
const EDGE_PX = 24;

// the finger is on something that takes a sideways drag for itself
function movesSideways(target: EventTarget | null) {
  let el = target instanceof Element ? target : null;
  if (
    el?.closest(
      'input, textarea, select, dialog, .app-sheet, [role="slider"], .vshelf-box',
    )
  )
    return true;
  for (; el && el !== document.body; el = el.parentElement) {
    const overflow = getComputedStyle(el).overflowX;
    if (
      (overflow === "auto" || overflow === "scroll") &&
      el.scrollWidth > el.clientWidth
    )
      return true;
  }
  return false;
}

export function useSwipeTabs(
  order: string[],
  current: string,
  onPick: (tab: string) => void,
  on: boolean,
) {
  const latest = useRef({ order, current, onPick });
  useEffect(() => {
    latest.current = { order, current, onPick };
  });

  useEffect(() => {
    if (!on || !inApp()) return;
    let from: { x: number; y: number; at: number } | null = null;
    const start = (e: TouchEvent) => {
      const t = e.touches[0];
      from = null;
      if (!t || e.touches.length > 1) return;
      if (t.clientX < EDGE_PX || t.clientX > window.innerWidth - EDGE_PX)
        return;
      if (movesSideways(e.target)) return;
      from = { x: t.clientX, y: t.clientY, at: performance.now() };
    };
    const end = (e: TouchEvent) => {
      const t = e.changedTouches[0];
      if (!from || !t) return;
      const dx = t.clientX - from.x;
      const dy = t.clientY - from.y;
      const quick = performance.now() - from.at < MAX_MS;
      from = null;
      if (
        !quick ||
        Math.abs(dx) < MIN_PX ||
        Math.abs(dx) < LEVEL * Math.abs(dy)
      )
        return;
      const { order, current, onPick } = latest.current;
      const at = order.indexOf(current);
      const next = order[at + (dx < 0 ? 1 : -1)];
      if (at < 0 || !next) return;
      tick();
      onPick(next);
    };
    document.addEventListener("touchstart", start, { passive: true });
    document.addEventListener("touchend", end, { passive: true });
    return () => {
      document.removeEventListener("touchstart", start);
      document.removeEventListener("touchend", end);
    };
  }, [on]);
}
