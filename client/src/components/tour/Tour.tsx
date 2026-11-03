// Kenji's guided tour: everything blurs and dims but one real button, and he points
// at it and explains it, like a video game tutorial. Runs on the pretend account in
// lib/demo.ts. If a step's button can't be found, he says his line anyway and offers
// a way on, so a changed page can't trap anyone.
import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { endDemo } from "../../lib/demo";
import Mascot from "../mascot/Mascot";
import { TOUR_STEPS } from "./steps";

const STEP_KEY = "demoTourStep";
const HOLE_PADDING = 8;
const GIVE_UP_AFTER_MS = 2500;
const BUBBLE_GAP = 26;
const SCREEN_MARGIN = 12;

type Box = { top: number; left: number; width: number; height: number };

const readStep = () => {
  try {
    const saved = Number(sessionStorage.getItem(STEP_KEY));
    return saved >= 0 && saved < TOUR_STEPS.length ? saved : 0;
  } catch {
    return 0;
  }
};

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
  const [bubbleHeight, setBubbleHeight] = useState(180);
  const bubble = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const step = TOUR_STEPS[index]!;
  const onPage = pathname.startsWith(step.path);

  const goTo = useCallback((next: number) => {
    setBox(null);
    setLost(false);
    setIndex(next);
    try {
      sessionStorage.setItem(STEP_KEY, String(next));
    } catch {
      /* it just won't survive a refresh */
    }
  }, []);

  // this step's page, if tapping the last one didn't lead here. A moment's wait, so
  // a real link that's already on its way isn't followed twice
  useEffect(() => {
    if (onPage || step.path.endsWith("/")) return;
    const timer = setTimeout(
      () => navigate(step.path, { viewTransition: true }),
      250,
    );
    return () => clearTimeout(timer);
  }, [onPage, step, navigate]);

  // keep the hole on its button as the page loads, scrolls and resizes
  useEffect(() => {
    if (!step.target || !onPage) return;
    let frame = 0;
    let found = false;
    let scrolled = false;
    const startedAt = Date.now();
    const follow = () => {
      const el = findTarget(step.target!);
      if (el) {
        found = true;
        if (!scrolled) {
          scrolled = true;
          el.scrollIntoView({ block: "center" });
        }
        const r = el.getBoundingClientRect();
        // a tall target stops at the screen's edge, or the phones' bottom bar
        const bar = [...document.querySelectorAll("nav")].find(
          (nav) =>
            getComputedStyle(nav).position === "fixed" &&
            nav.getClientRects().length > 0,
        );
        const floor = (bar?.getBoundingClientRect().top ?? innerHeight) - SCREEN_MARGIN;
        const top = Math.round(r.top - HOLE_PADDING);
        const next = {
          top,
          left: Math.round(r.left - HOLE_PADDING),
          width: Math.round(r.width + HOLE_PADDING * 2),
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
      } else if (!found && Date.now() - startedAt > GIVE_UP_AFTER_MS) {
        setLost(true);
      }
      frame = requestAnimationFrame(follow);
    };
    frame = requestAnimationFrame(follow);
    return () => cancelAnimationFrame(frame);
  }, [step, onPage]);

  // tapping the real thing does its job, and moves the tour on
  useEffect(() => {
    if (!step.tap || !step.target) return;
    const onClick = (e: MouseEvent) => {
      const clicked = e.target as Element | null;
      // the real control, not just somewhere near it
      if (
        clicked?.closest(`[data-tour="${step.target}"]`) &&
        clicked.closest("a, button")
      ) {
        goTo(index + 1);
      }
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, [step, index, goTo]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") endDemo();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  // screen readers and keyboards go to what he's saying, and the real measurement
  // lets the bubble sit clear of the hole
  useEffect(() => {
    if (!bubble.current) return;
    setBubbleHeight(bubble.current.offsetHeight);
    bubble.current.focus({ preventScroll: true });
  }, [index, lost]);

  const isLast = index === TOUR_STEPS.length - 1;
  const showHole = Boolean(box) && !lost;
  // over or under the hole, whichever side has the room; middle of the screen if
  // there's nothing to point at
  const holeMiddle = box ? box.top + box.height / 2 : 0;
  const below = holeMiddle < innerHeight / 2;
  const bubbleTop = !showHole
    ? Math.max(SCREEN_MARGIN, (innerHeight - bubbleHeight) / 2)
    : Math.min(
        Math.max(
          SCREEN_MARGIN,
          below ? box!.top + box!.height + BUBBLE_GAP : box!.top - bubbleHeight - BUBBLE_GAP,
        ),
        innerHeight - bubbleHeight - SCREEN_MARGIN,
      );
  const bubbleWidth = Math.min(340, innerWidth - SCREEN_MARGIN * 2);
  const holeCenter = box ? box.left + box.width / 2 : innerWidth / 2;
  const bubbleLeft = !showHole
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

  return (
    <div className="tour" aria-live="polite">
      <div
        className="tour-veil"
        style={showHole ? { clipPath: holePath(box!) } : undefined}
      />
      {showHole && (
        <>
          <div
            className={`tour-ring ${step.tap ? "tour-ring-tap" : ""}`}
            style={box!}
          />
          {/* something only being explained can't be tapped by accident */}
          {!step.tap && <div className="tour-shield" style={box!} />}
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
        </>
      )}

      <div
        ref={bubble}
        role="dialog"
        aria-label="Kenji's tour"
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
            {index + 1} of {TOUR_STEPS.length}
          </p>
          <p className="tour-say">{step.say}</p>
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
                {(step.button || lost) && (
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={() => goTo(index + 1)}
                  >
                    {step.button ?? "Next"}
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
    </div>
  );
}
