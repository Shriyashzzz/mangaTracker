// Android's ink ripple on whatever is tapped, inside the app only
// (lib/inApp.ts). One listener for the whole page: no component draws its
// own. The ink spreads from the finger in the tapped thing's own text colour
// (index.css .ripple), so it shows on cream buttons and on red ones alike.
import { inApp } from "./inApp";

const TAPPABLE =
  'button, a[href], summary, label, [role="button"], [role="tab"], [role="menuitem"], [role="option"], [role="switch"], [role="checkbox"]';
// typing fields keep their caret; anything can opt out with data-no-ripple
const NO_RIPPLE =
  'input:not([type="checkbox"]):not([type="radio"]), textarea, select, [contenteditable="true"], [data-no-ripple], :disabled, [aria-disabled="true"]';

// a finger that's about to scroll shouldn't light up what it started on, so
// touch waits this long (Android waits too) unless the finger lifts first
const TOUCH_WAIT_MS = 70;
// a finger that moves this far is scrolling
const SCROLL_PX = 10;
// a quick tap still shows the ink this long before it fades
const LEAST_SHOWN_MS = 180;

const reducedMotion = () =>
  matchMedia("(prefers-reduced-motion: reduce)").matches;

type Press = {
  target: HTMLElement;
  x: number;
  y: number;
  timer?: number;
  release?: () => void;
};
let press: Press | null = null;

function tappableAt(target: EventTarget | null): HTMLElement | null {
  if (!(target instanceof Element)) return null;
  if (target.closest(NO_RIPPLE)) return null;
  return target.closest<HTMLElement>(TAPPABLE);
}

// draws the ink and returns how to let it go
function draw(host: HTMLElement, x: number, y: number) {
  const box = host.getBoundingClientRect();
  if (!box.width || !box.height) return () => {};

  // the layer sits inside the element, so it moves and clips with it
  const madeRelative = getComputedStyle(host).position === "static";
  if (madeRelative) host.classList.add("ripple-host");
  const layer = document.createElement("span");
  layer.className = "ripple";
  layer.setAttribute("aria-hidden", "true");
  const ink = document.createElement("span");
  // big enough to reach the corner farthest from the finger
  const reach = Math.hypot(
    Math.max(x - box.left, box.right - x),
    Math.max(y - box.top, box.bottom - y),
  );
  ink.style.left = `${x - box.left - reach}px`;
  ink.style.top = `${y - box.top - reach}px`;
  ink.style.width = ink.style.height = `${reach * 2}px`;
  layer.append(ink);
  host.append(layer);

  const shownAt = performance.now();
  if (reducedMotion())
    // no spreading, just the wash coming up (index.css: 0.12)
    ink.animate([{ opacity: 0 }, { opacity: 0.12 }], { duration: 100 });
  else
    ink.animate([{ transform: "scale(0.1)" }, { transform: "scale(1)" }], {
      duration: 380,
      easing: "cubic-bezier(0.2, 0, 0, 1)",
    });

  return () => {
    const wait = Math.max(0, LEAST_SHOWN_MS - (performance.now() - shownAt));
    const fade = layer.animate([{ opacity: 1 }, { opacity: 0 }], {
      duration: 240,
      delay: wait,
      easing: "ease-out",
      fill: "forwards",
    });
    fade.onfinish = () => {
      layer.remove();
      if (madeRelative && !host.querySelector(":scope > .ripple"))
        host.classList.remove("ripple-host");
    };
  };
}

function start(p: Press) {
  p.timer = undefined;
  p.release = draw(p.target, p.x, p.y);
}

// the finger lifted: show the ink if it hadn't started yet, then fade it
function lift() {
  if (!press) return;
  if (press.timer !== undefined) {
    clearTimeout(press.timer);
    start(press);
  }
  press.release?.();
  press = null;
}

// it turned into a scroll: never draw, or fade what was drawn
function drop() {
  if (!press) return;
  clearTimeout(press.timer);
  press.release?.();
  press = null;
}

export function startRipples() {
  if (!inApp()) return;
  document.addEventListener(
    "pointerdown",
    (e) => {
      drop();
      if (e.button !== 0) return;
      const target = tappableAt(e.target);
      if (!target) return;
      press = { target, x: e.clientX, y: e.clientY };
      if (e.pointerType === "touch") {
        const p = press;
        p.timer = window.setTimeout(() => start(p), TOUCH_WAIT_MS);
      } else start(press);
    },
    { capture: true, passive: true },
  );
  document.addEventListener(
    "pointermove",
    (e) => {
      if (
        press &&
        Math.hypot(e.clientX - press.x, e.clientY - press.y) > SCROLL_PX
      )
        drop();
    },
    { capture: true, passive: true },
  );
  document.addEventListener("pointerup", lift, { capture: true });
  document.addEventListener("pointercancel", drop, { capture: true });
  document.addEventListener("scroll", drop, { capture: true, passive: true });
}
