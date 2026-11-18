// Swipe a message off the screen: the undo notes ("Deleted · Undo") and the
// small popups that sit over the bottom of a phone's screen. Each one hides
// the add button while it's up, so someone who has read it can send it away
// with a finger instead of waiting for it to run out.
//
// Spread what this returns on the message's own box:
//   <div {...useSwipeAway(close)}>
// It follows the finger left, right or down; let go far enough (or flick) and
// it slides off and `onAway` is called, otherwise it springs back. The rule
// for "far enough" is swipeAway.ts. Fingers and pens only: with a mouse
// nothing changes. A swipe that starts on a button doesn't press it.
import { useRef, type CSSProperties, type PointerEvent } from "react";
import {
  swipeDistance,
  swipeLeaves,
  swipeWay,
  type SwipeWay,
} from "./swipeAway";

// sliding off, and springing back
const AWAY_MS = 180;
const BACK_MS = 160;
const EASE = "cubic-bezier(0.2, 0.8, 0.2, 1)";

const lessMotion = () =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// where the box sits when it has gone this far that way
const placeAt = (way: SwipeWay, distance: number) => {
  if (way === "left") return `${-distance}px 0`;
  if (way === "right") return `${distance}px 0`;
  return `0 ${distance}px`;
};

type Drag = {
  id: number;
  x: number;
  y: number;
  at: number;
  // set once the finger has moved far enough to say which way
  way: SwipeWay | null;
};

export function useSwipeAway(onAway: () => void) {
  const drag = useRef<Drag | null>(null);
  // the swipe that just ended started on a button: its click is swallowed
  const swiped = useRef(false);

  const sizeAlong = (box: HTMLElement, way: SwipeWay) =>
    way === "down" ? box.offsetHeight : box.offsetWidth;

  const putBack = (box: HTMLElement) => {
    box.style.transition = lessMotion()
      ? ""
      : `translate ${BACK_MS}ms ${EASE}, opacity ${BACK_MS}ms ${EASE}`;
    box.style.translate = "";
    box.style.opacity = "";
  };

  const sendAway = (box: HTMLElement, way: SwipeWay) => {
    const done = () => {
      onAway();
      // one that stays on the page after all (its owner kept it) is put back
      window.setTimeout(() => {
        if (!box.isConnected) return;
        box.style.transition = "";
        box.style.translate = "";
        box.style.opacity = "";
      }, 400);
    };
    if (lessMotion()) return done();
    box.style.transition = `translate ${AWAY_MS}ms ${EASE}, opacity ${AWAY_MS}ms ${EASE}`;
    box.style.translate = placeAt(way, sizeAlong(box, way) * 1.2);
    box.style.opacity = "0";
    window.setTimeout(done, AWAY_MS);
  };

  const onPointerDown = (e: PointerEvent<HTMLElement>) => {
    if (e.pointerType === "mouse" || drag.current) return;
    swiped.current = false;
    drag.current = {
      id: e.pointerId,
      x: e.clientX,
      y: e.clientY,
      at: e.timeStamp,
      way: null,
    };
  };

  const onPointerMove = (e: PointerEvent<HTMLElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    const box = e.currentTarget;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (!d.way) {
      d.way = swipeWay(dx, dy);
      if (!d.way) return;
      // it's a swipe now: the box keeps the finger, wherever it goes
      box.setPointerCapture(e.pointerId);
      box.style.transition = "none";
      swiped.current = true;
    }
    const distance = swipeDistance(d.way, dx, dy);
    box.style.translate = placeAt(d.way, distance);
    // fading as it goes, so letting go reads as "it will leave"
    const gone = Math.min(1, distance / sizeAlong(box, d.way));
    box.style.opacity = String(1 - gone * 0.6);
  };

  const end = (e: PointerEvent<HTMLElement>, cancelled: boolean) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    drag.current = null;
    if (!d.way) return;
    const box = e.currentTarget;
    const distance = swipeDistance(d.way, e.clientX - d.x, e.clientY - d.y);
    const leaves =
      !cancelled &&
      swipeLeaves(distance, sizeAlong(box, d.way), e.timeStamp - d.at);
    if (leaves) sendAway(box, d.way);
    else putBack(box);
  };

  return {
    onPointerDown,
    onPointerMove,
    onPointerUp: (e: PointerEvent<HTMLElement>) => end(e, false),
    onPointerCancel: (e: PointerEvent<HTMLElement>) => end(e, true),
    // the click a finger makes when it lifts after a swipe
    onClickCapture: (e: {
      preventDefault(): void;
      stopPropagation(): void;
    }) => {
      if (!swiped.current) return;
      swiped.current = false;
      e.preventDefault();
      e.stopPropagation();
    },
    // the browser leaves the swipe to us: no scrolling the page from a message
    style: { touchAction: "none" } satisfies CSSProperties,
  };
}
