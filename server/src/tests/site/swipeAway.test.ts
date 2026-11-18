// The rule for swiping a message off a phone's screen
// (client/src/lib/swipeAway.ts): which way a drag goes, and when letting go
// sends the message away.
import {
  SWIPE_STARTS_PX,
  swipeDistance,
  swipeLeaves,
  swipeWay,
} from "../../../../client/src/lib/swipeAway.js";

test("a wobble under a few pixels is still a tap", () => {
  expect(swipeWay(3, -2)).toBe(null);
  expect(swipeWay(SWIPE_STARTS_PX, 0)).toBe("right");
});

test("a message goes left, right or down, never up", () => {
  expect(swipeWay(-40, 5)).toBe("left");
  expect(swipeWay(40, -5)).toBe("right");
  expect(swipeWay(4, 40)).toBe("down");
  expect(swipeWay(4, -40)).toBe(null);
});

test("it only moves along the way it's going", () => {
  expect(swipeDistance("left", -50, 20)).toBe(50);
  // dragged back past where it started: it stays put
  expect(swipeDistance("left", 30, 0)).toBe(0);
  expect(swipeDistance("down", 80, 25)).toBe(25);
});

test("let go past a third of its size and it leaves", () => {
  // a 300px note, dragged slowly
  expect(swipeLeaves(101, 300, 2000)).toBe(true);
  expect(swipeLeaves(60, 300, 2000)).toBe(false);
  // a small one still needs a real drag, not a third of very little
  expect(swipeLeaves(30, 60, 2000)).toBe(false);
  expect(swipeLeaves(56, 60, 2000)).toBe(true);
});

test("a quick flick leaves too, but not a twitch", () => {
  expect(swipeLeaves(40, 300, 60)).toBe(true);
  expect(swipeLeaves(12, 300, 10)).toBe(false);
});
