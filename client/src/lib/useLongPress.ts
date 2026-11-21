// Android's long press, in the app only (lib/inApp.ts): holding a card half
// a second starts selecting with it picked (pages/Home/Home.tsx), as a long
// press does in Android's own lists. A short tap stays a tap, a finger that
// moves is a scroll, and Chrome's own menu for a held link doesn't open.
// Chrome's own long press (its contextmenu event) counts as the hold too:
// it can cancel the touch before the half second is up
import { useRef, type PointerEvent } from "react";
import { tick } from "./haptics";
import { inApp } from "./inApp";

const HOLD_MS = 500;
// a finger moving more than this is scrolling, not holding
const SLOP = 10;

// the click the lifted finger sends after a hold: by then the card may be
// Select's tick box, which it would untick. Only that click: when Chrome
// took the hold as its own long press, lifting sends none, so the next
// press (a new tap, like Select's ✕) drops this and works as ever
function swallowLiftingClick() {
  const stop = (e: Event) => {
    e.preventDefault();
    e.stopPropagation();
    forget();
  };
  const forget = () => {
    document.removeEventListener("click", stop, { capture: true });
    document.removeEventListener("pointerdown", forget, { capture: true });
  };
  document.addEventListener("click", stop, { capture: true });
  document.addEventListener("pointerdown", forget, { capture: true });
}

export function useLongPress(onLongPress: (() => void) | undefined) {
  const timer = useRef(0);
  const from = useRef<{ x: number; y: number } | null>(null);
  // the click that follows a long press opens nothing
  const fired = useRef(false);
  if (!onLongPress || !inApp()) return {};
  const cancel = () => {
    window.clearTimeout(timer.current);
    from.current = null;
  };
  // the hold itself, once, whichever of the timer and Chrome says so first
  const hold = () => {
    if (fired.current) return;
    fired.current = true;
    cancel();
    tick();
    onLongPress();
    swallowLiftingClick();
  };
  return {
    onPointerDown: (e: PointerEvent) => {
      if (e.pointerType !== "touch") return;
      fired.current = false;
      from.current = { x: e.clientX, y: e.clientY };
      timer.current = window.setTimeout(hold, HOLD_MS);
    },
    onPointerMove: (e: PointerEvent) => {
      const at = from.current;
      if (at && Math.hypot(e.clientX - at.x, e.clientY - at.y) > SLOP) cancel();
    },
    onPointerUp: cancel,
    // Chrome's own long press cancels the touch, then sends contextmenu
    onPointerCancel: cancel,
    onClick: (e: { preventDefault: () => void }) => {
      if (fired.current) e.preventDefault();
      fired.current = false;
    },
    // Chrome's long press: the hold, never its menu for a held link
    onContextMenu: (e: { preventDefault: () => void }) => {
      e.preventDefault();
      hold();
    },
  };
}
