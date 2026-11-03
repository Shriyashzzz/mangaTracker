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
  // he's placed from the screen's size, so a rotated phone has to place him again
  const [, onScreenChange] = useReducer((n: number) => n + 1, 0);
  const [bubbleHeight, setBubbleHeight] = useState(180);
  const bubble = useRef<HTMLDivElement>(null);
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
        // a tall target stops at the screen's edge, or the phones' bottom bar
        const bar = [...document.querySelectorAll("nav")].find(
          (nav) =>
            getComputedStyle(nav).position === "fixed" &&
            nav.getClientRects().length > 0,
        );
        const floor =
          bar && !bar.contains(el)
            ? bar.getBoundingClientRect().top - SCREEN_MARGIN
            : innerHeight - RING_INSET;
        // the ring stays on screen, even around a tab that touches its edges
        const top = Math.round(r.top - HOLE_PADDING);
        const left = Math.round(Math.max(r.left - HOLE_PADDING, RING_INSET));
        const right = Math.min(r.right + HOLE_PADDING, innerWidth - RING_INSET);
        const next = {
          top,
          left,
          width: Math.round(right - left),
          height: Math.round(Math.min(r.bottom + HOLE_PADDING, floor) - top),
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
      if (e.key === "Escape" && bubble.current?.contains(document.activeElement)) {
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
  const inCorner = step.free || wentExploring || (showHole && !fits);
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
  }, [index, lost, wentExploring, bubbleWidth]);

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

  // screen readers and keyboards go to what he's saying, once he can be seen
  useEffect(() => {
    if (!waiting) bubble.current?.focus({ preventScroll: true });
  }, [index, lost, waiting]);

  // on <body>, above things like the shelf's add button that live there too
  return createPortal(
    <div className="tour" aria-live="polite">
      {veiled && (
        <div
          className="tour-veil"
          style={showHole ? { clipPath: holePath(box!) } : undefined}
        />
      )}
      {showHole && (
        <>
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
        </>
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
            {wentExploring
              ? step.doneOnLeaving && pathname.startsWith("/details/")
                ? "It's on your shelf! Have a look, then carry on when you're ready."
                : "Exploring? Good, that's the idea. I'll be here when you want to carry on."
              : step.say}
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
            ) : wentExploring ? (
              <>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={step.doneOnLeaving ? () => goTo(index + 1) : backToStep}
                >
                  Back to the tour
                </button>
                <button type="button" className="tour-skip" onClick={() => endDemo()}>
                  Skip tour
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
