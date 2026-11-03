// Kenji's guided tour, like a video game tutorial: he points at a real button and
// explains it, on the pretend account in lib/demo.ts. The page stays clear and usable
// so people can really try things; only a few big moments blur the rest (step.focus).
// Wandering off is fine: he waits, and offers the way back. If a step's button can't
// be found he says his line anyway and offers a way on, so nothing can trap anyone.
import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation, useNavigate } from "react-router";
import { hasBottomBar } from "../../lib/bottomBar";
import { endDemo } from "../../lib/demo";
import Mascot from "../mascot/Mascot";
import { TOUR_STEPS, type TourStep } from "./steps";

const STEP_KEY = "demoTourStep";
const HOLE_PADDING = 8;
const GIVE_UP_AFTER_MS = 2500;
// long enough for the step's own page to have arrived; off it after this, they've
// gone exploring
const SETTLED_AFTER_MS = 900;
const BUBBLE_GAP = 26;
const SCREEN_MARGIN = 12;
const RING_INSET = 3;
const WIDE_SCREEN = 1024;
const SWITCH_SETTLES_MS = 200;
const BOTTOM_BAR = 59;

type Box = { top: number; left: number; width: number; height: number };

const readStep = () => {
  try {
    const saved = Number(sessionStorage.getItem(STEP_KEY));
    return saved >= 0 && saved < TOUR_STEPS.length ? saved : 0;
  } catch {
    return 0;
  }
};

const isOnStepPage = (step: TourStep, pathname: string) =>
  step.exact ? pathname === step.path : pathname.startsWith(step.path);

// the first one on screen: the shelf has one add button for phones, one for laptops
const findTarget = (name: string) =>
  [...document.querySelectorAll<HTMLElement>(`[data-tour="${name}"]`)].find(
    (el) => el.getClientRects().length > 0,
  ) ?? null;

// the part of a box above the phones' bottom bar, which the blur leaves alone
const visibleBox = (box: Box, floor: number): Box => ({
  ...box,
  height: Math.max(0, Math.min(box.top + box.height, floor) - box.top),
});

// everything but the hole, for blurring and dimming; the hole lets taps through
const holePath = ({ top, left, width, height }: Box) => {
  const right = left + width;
  const bottom = top + height;
  return `path(evenodd, "M0 0H${innerWidth}V${innerHeight}H0Z M${left} ${top}H${right}V${bottom}H${left}Z")`;
};

export default function Tour() {
  const [index, setIndex] = useState(readStep);
  const [box, setBox] = useState<Box | null>(null);
  const [lost, setLost] = useState(false);
  const [settled, setSettled] = useState(false);
  // where the screen ends for the tour: the top of the phones' bottom bar
  const [floor, setFloor] = useState(() => innerHeight);
  // he's placed from the screen's size, so a rotated phone has to place him again
  const [, onScreenChange] = useReducer((n: number) => n + 1, 0);
  const [bubbleHeight, setBubbleHeight] = useState(180);
  const bubble = useRef<HTMLDivElement>(null);
  const dock = useRef<HTMLButtonElement>(null);
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const step = TOUR_STEPS[index]!;
  const onPage = isOnStepPage(step, pathname);

  const goTo = useCallback((next: number) => {
    setBox(null);
    setLost(false);
    setSettled(false);
    setIndex(next);
    try {
      sessionStorage.setItem(STEP_KEY, String(next));
      if (TOUR_STEPS[next]?.allTab) sessionStorage.setItem("libraryStatus", "all");
    } catch {
      /* it just won't survive a refresh */
    }
  }, []);

  const wentExploring = !onPage && settled;
  const backToStep = useCallback(
    () => navigate(step.go ?? step.path, { viewTransition: true }),
    [navigate, step],
  );

  // a new step's page, if tapping the last one didn't lead there. Only when the step
  // starts, never to pull someone back from exploring. A moment's wait, so a real
  // link that's already on its way isn't followed twice
  useEffect(() => {
    const leads = setTimeout(() => {
      if (!isOnStepPage(step, window.location.pathname)) backToStep();
    }, 250);
    const settles = setTimeout(() => setSettled(true), SETTLED_AFTER_MS);
    return () => {
      clearTimeout(leads);
      clearTimeout(settles);
    };
  }, [step, backToStep]);

  // keep the hole on its button as the page loads, scrolls and resizes
  useEffect(() => {
    if (!step.target || !onPage) return;
    let frame = 0;
    let found = false;
    let scrolled = false;
    let heldStill: HTMLElement | null = null;
    const startedAt = Date.now();
    const follow = () => {
      const el = findTarget(step.target!);
      if (el) {
        found = true;
        if (step.lookOnly && el !== heldStill) {
          el.inert = true;
          heldStill = el;
        }
        if (!scrolled) {
          scrolled = true;
          // a big section starts at the top, leaving Kenji room below it
          const tall = el.offsetHeight > innerHeight * 0.45;
          el.scrollIntoView({ block: tall ? "start" : "center" });
        }
        const r = el.getBoundingClientRect();
        // the phones' bottom bar covers the ring the way it covers the page, so a
        // tall section scrolls under it rather than its ring stopping short
        const bar = [...document.querySelectorAll("nav")].find(
          (nav) =>
            getComputedStyle(nav).position === "fixed" &&
            nav.getClientRects().length > 0 &&
            !nav.contains(el),
        );
        setFloor(Math.round(bar?.getBoundingClientRect().top ?? innerHeight));
        // the ring is the target's own box, scrolling with it. Only its sides are
        // kept on screen, for a tab that touches the edges
        const top = Math.round(r.top - HOLE_PADDING);
        const left = Math.round(Math.max(r.left - HOLE_PADDING, RING_INSET));
        const right = Math.min(r.right + HOLE_PADDING, innerWidth - RING_INSET);
        const next = {
          top,
          left,
          width: Math.round(right - left),
          height: Math.round(r.bottom + HOLE_PADDING - top),
        };
        setBox((old) =>
          old &&
          old.top === next.top &&
          old.left === next.left &&
          old.width === next.width &&
          old.height === next.height
            ? old
            : next,
        );
        setLost(false);
      } else if (found || Date.now() - startedAt > GIVE_UP_AFTER_MS) {
        // never there, or gone since, like hiding the only thing on the list. No ring
        // around nothing, and it comes back if they undo
        setLost(true);
      }
      frame = requestAnimationFrame(follow);
    };
    frame = requestAnimationFrame(follow);
    return () => {
      cancelAnimationFrame(frame);
      if (heldStill) heldStill.inert = false;
    };
  }, [step, onPage]);

  // tapping the real thing does its job, and moves the tour on
  useEffect(() => {
    if (!step.tap || !step.target) return;
    let opening: ReturnType<typeof setTimeout>;
    const onClick = (e: MouseEvent) => {
      const clicked = e.target as Element | null;
      // the real control, not just somewhere near it
      if (
        clicked?.closest(`[data-tour="${step.target}"]`) &&
        clicked.closest("a, button, input, label")
      ) {
        if (!step.opensNext) {
          goTo(index + 1);
          return;
        }
        // switched off instead of on: stay here
        opening = setTimeout(() => {
          if (findTarget(TOUR_STEPS[index + 1]!.target!)) goTo(index + 1);
        }, SWITCH_SETTLES_MS);
      }
    };
    document.addEventListener("click", onClick);
    return () => {
      clearTimeout(opening);
      document.removeEventListener("click", onClick);
    };
  }, [step, index, goTo]);

  useEffect(() => {
    window.addEventListener("resize", onScreenChange);
    return () => window.removeEventListener("resize", onScreenChange);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // only from Kenji himself: Escape also closes menus and suggestion lists
      const onKenji = [bubble.current, dock.current].some((el) =>
        el?.contains(document.activeElement),
      );
      if (e.key === "Escape" && onKenji) {
        endDemo();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  // Next does what the step was about, so what comes after has what it needs: the
  // dates are only there once the red bar is open
  const next = () => {
    const upcoming = TOUR_STEPS[index + 1]?.target;
    const alreadyOpen = step.opensNext && upcoming && findTarget(upcoming);
    if (step.tap && step.target && !alreadyOpen) findTarget(step.target)?.click();
    goTo(index + 1);
  };

  const isLast = index === TOUR_STEPS.length - 1;
  const showHole = Boolean(box) && !lost && onPage;
  const veiled = step.focus && !wentExploring;
  // over or under what he's pointing at, if either has the room. A section too big
  // for that gets him out of the way at the bottom, where it can still be read
  const roomAbove = box ? box.top - BUBBLE_GAP - SCREEN_MARGIN : 0;
  const barSpace = hasBottomBar() ? BOTTOM_BAR : 0;
  const roomBelow = box
    ? innerHeight - barSpace - (box.top + box.height) - BUBBLE_GAP - SCREEN_MARGIN
    : 0;
  const fits = Math.max(roomAbove, roomBelow) >= bubbleHeight;
  const inCorner = showHole && !fits;
  // the page is theirs: Kenji shrinks to a bar at the bottom they tap to carry on
  const docked = (step.free || wentExploring) && !isLast;
  // over or under the hole, whichever side has the room; middle of the screen if
  // there's nothing to point at
  const holeMiddle = box ? box.top + box.height / 2 : 0;
  const below =
    roomBelow >= bubbleHeight && (roomAbove < bubbleHeight || holeMiddle < innerHeight / 2);
  const bubbleTop = inCorner
    ? innerHeight - bubbleHeight - SCREEN_MARGIN - (hasBottomBar() ? BOTTOM_BAR : 0)
    : !showHole
    ? Math.max(SCREEN_MARGIN, (innerHeight - bubbleHeight) / 2)
    : Math.min(
        Math.max(
          SCREEN_MARGIN,
          below ? box!.top + box!.height + BUBBLE_GAP : box!.top - bubbleHeight - BUBBLE_GAP,
        ),
        innerHeight - bubbleHeight - SCREEN_MARGIN,
      );
  // in the corner of a wide screen he stays beside the page's column, not over it
  const bubbleWidth =
    inCorner && innerWidth >= WIDE_SCREEN
      ? 300
      : Math.min(340, innerWidth - SCREEN_MARGIN * 2);

  // the real measurement lets the bubble sit clear of the hole
  useEffect(() => {
    if (bubble.current) setBubbleHeight(bubble.current.offsetHeight);
  }, [index, lost, docked, bubbleWidth]);

  const holeCenter = box ? box.left + box.width / 2 : innerWidth / 2;
  const bubbleLeft = inCorner
    ? SCREEN_MARGIN
    : !showHole
    ? (innerWidth - bubbleWidth) / 2
    : Math.min(
        Math.max(SCREEN_MARGIN, holeCenter - bubbleWidth / 2),
        innerWidth - bubbleWidth - SCREEN_MARGIN,
      );
  const pointerLeft = Math.min(
    Math.max(bubbleLeft + 22, holeCenter),
    bubbleLeft + bubbleWidth - 22,
  );

  // waiting for the page: no veil over a page that's still arriving
  const waiting = Boolean(step.target) && onPage && !box && !lost;

  // screen readers and keyboards go to what he's saying, once he can be seen. Not
  // to the bar when they've wandered off: they're busy with the page
  useEffect(() => {
    if (step.free) dock.current?.focus({ preventScroll: true });
    else if (!waiting) bubble.current?.focus({ preventScroll: true });
  }, [index, lost, waiting, step.free]);

  if (docked) {
    const line = step.free
      ? step.say
      : step.doneOnLeaving && pathname.startsWith("/details/")
        ? "It's on your shelf! Have a look around."
        : "Exploring? Good, that's the idea.";
    return createPortal(
      <div className="tour" aria-live="polite">
        <button
          ref={dock}
          type="button"
          className="tour-dock"
          style={{ bottom: `calc(${barSpace + SCREEN_MARGIN}px + env(safe-area-inset-bottom))` }}
          onClick={step.free || step.doneOnLeaving ? () => goTo(index + 1) : backToStep}
        >
          <span className="tour-dock-face printed" aria-hidden>
            <Mascot mood="happy" />
          </span>
          <span className="tour-dock-words">
            <span className="tour-dock-say">{line}</span>
            <span className="tour-dock-go">Back to the tour</span>
          </span>
          <svg className="tour-dock-arrow" viewBox="0 0 24 24" aria-hidden>
            <path d="M5 12h13M13 6l6 6-6 6" />
          </svg>
        </button>
      </div>,
      document.body,
    );
  }

  // on <body>, above things like the shelf's add button that live there too
  return createPortal(
    <div className="tour" aria-live="polite">
      {veiled && (
        <div
          className="tour-veil"
          style={showHole ? { clipPath: holePath(visibleBox(box!, floor)) } : undefined}
        />
      )}
      {showHole && (
        <div className="tour-stage" style={{ clipPath: `inset(0 0 ${innerHeight - floor}px 0)` }}>
          <div
            className={`tour-ring ${step.tap ? "tour-ring-tap" : ""}`}
            style={box!}
          />
          {/* in a blurred moment, what's only being explained stays put */}
          {step.focus && !step.tap && <div className="tour-shield" style={box!} />}
          {fits && (
            <svg
              className={`tour-pointer ${below ? "tour-pointer-below" : ""}`}
              style={{
                left: pointerLeft - 16,
                top: below ? box!.top + box!.height + 2 : box!.top - 26,
              }}
              viewBox="0 0 32 24"
              aria-hidden
            >
              <path d="M4 3h24L16 21Z" />
            </svg>
          )}
        </div>
      )}

      <div
        ref={bubble}
        role="dialog"
        aria-label="Kenji's tour"
        data-target={step.target}
        tabIndex={-1}
        className={`tour-bubble ${waiting ? "tour-bubble-waiting" : ""}`}
        key={index}
        style={{ top: bubbleTop, left: bubbleLeft, width: bubbleWidth }}
      >
        <div className="tour-who printed" aria-hidden>
          <Mascot mood="happy" />
        </div>
        <div className="tour-words">
          <p className="tour-count">
            {step.part}
            {step.partSize > 1 && ` · ${step.partStep} of ${step.partSize}`}
          </p>
          <p className="tour-say">
            {step.say}
          </p>
          <div className="tour-actions">
            {isLast ? (
              <>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => endDemo("/signup")}
                >
                  Start your shelf
                </button>
                <button type="button" className="tour-skip" onClick={() => endDemo()}>
                  Leave the tour
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={next}
                >
                  Next
                </button>
                {index > 0 && (
                  <button
                    type="button"
                    className="tour-skip"
                    onClick={() =>
                      goTo(TOUR_STEPS[index - 1]!.needsLastStep ? index - 2 : index - 1)
                    }
                  >
                    Back
                  </button>
                )}
                <button type="button" className="tour-skip" onClick={() => endDemo()}>
                  Skip tour
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
