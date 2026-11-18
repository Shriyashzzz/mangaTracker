// The rule for swiping a message off the screen, kept apart from the hook
// that follows the finger (useSwipeAway.ts) so it can be tested on its own.
// No imports: the server's tests run it too.
//
// A message at the bottom of the screen goes left, right or down. Never up:
// that's the way into the page, and a message dragged there would sit on
// what it's about.

export type SwipeWay = "left" | "right" | "down";

// a finger has to move this far before it's a swipe, not a tap that wobbled
export const SWIPE_STARTS_PX = 8;
// let go past a third of the message's size (never less than this), and it
// leaves
const LEAVES_AT_LEAST_PX = 56;
// or flicked: this fast, having moved at least this far
const FLICK_PX_PER_MS = 0.5;
const FLICK_AT_LEAST_PX = 24;

// which way a drag is going once it has started, or null while it's still a
// tap (or heading up)
export function swipeWay(dx: number, dy: number): SwipeWay | null {
  if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE_STARTS_PX) return null;
  if (Math.abs(dx) >= Math.abs(dy)) return dx < 0 ? "left" : "right";
  return dy > 0 ? "down" : null;
}

// how far the message has gone along its way (never backwards past where it
// started)
export const swipeDistance = (way: SwipeWay, dx: number, dy: number) => {
  if (way === "left") return Math.max(0, -dx);
  if (way === "right") return Math.max(0, dx);
  return Math.max(0, dy);
};

// Whether letting go here sends it away: dragged a third of its size along
// the way it's going, or flicked. `size` is its width for a sideways swipe,
// its height for one going down
export function swipeLeaves(distance: number, size: number, tookMs: number) {
  if (distance >= Math.max(LEAVES_AT_LEAST_PX, size / 3)) return true;
  const speed = tookMs > 0 ? distance / tookMs : 0;
  return distance >= FLICK_AT_LEAST_PX && speed >= FLICK_PX_PER_MS;
}
