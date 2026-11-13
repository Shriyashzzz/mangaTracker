// Kenji's guided tour, like a video game tutorial: he points at a real button and
// explains it, on the pretend account in lib/demo.ts. The page stays clear and usable
// so people can really try things; only a few big moments blur the rest (step.focus).
// Wandering off is fine: he waits, and offers the way back. If a step's button can't
// be found he says his line anyway and offers a way on, so nothing can trap anyone.
import {
  BUBBLE_GAP,
  bubbleLeftFor,
  bubbleTopFor,
  SCREEN_MARGIN,
  type Box,
} from "./tourPlace";
import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation, useNavigate } from "react-router";
import { hasBottomBar } from "../../lib/bottomBar";
import { endDemo, wasSignedInBeforeTour } from "../../lib/demo";
import Mascot from "../mascot/Mascot";
import { TOUR_STEPS, type TourStep } from "./steps";

const STEP_KEY = "demoTourStep";
const HOLE_PADDING = 8;
const GIVE_UP_AFTER_MS = 2500;
// long enough for the step's own page to have arrived; off it after this, they've
// gone exploring
const SETTLED_AFTER_MS = 900;
const RING_INSET = 3;
const SWITCH_SETTLES_MS = 200;
// once the page has settled, so it doesn't open over a page still arriving
const MENU_OPENS_AFTER_MS = 400;
const MIN_SIDE_WIDTH = 280;
const BOTTOM_BAR = 59;

// where the target is: on the page (scrolls with it, so the ring is drawn on the
// page and the browser moves them together, even mid-scroll on a phone), or
// pinned to the screen (fixed bars, sticky tabs, the header), which stays put
// Pinned near the bottom, like the phones' floating + button, it's also kept as
// the distance from the screen's bottom edge: a phone's address bar shrinking
// mid-scroll moves that edge, and what's placed from it moves with the button
type Anchor = Box & { pinned: boolean; fromBottom: number | null };

// fixed or sticky somewhere above it, or in the header: it doesn't scroll away
const isPinned = (el: HTMLElement) => {
  if (el.closest("header")) return true;
  for (let e: HTMLElement | null = el; e; e = e.parentElement) {
    const { position } = getComputedStyle(e);
    if (position === "fixed" || position === "sticky") return true;
  }
  return false;
};

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

// everything but the hole, for blurring and dimming; the hole lets taps through.
// Over the screen, or over the whole page when the hole moves with it
const holePath = (
  { top, left, width, height }: Box,
  areaWidth = innerWidth,
  areaHeight = innerHeight,
) => {
  const right = left + width;
  const bottom = top + height;
  return `path(evenodd, "M0 0H${areaWidth}V${areaHeight}H0Z M${left} ${top}H${right}V${bottom}H${left}Z")`;
};

export default function Tour() {
  // their real account, not the practice one the tour signs them into
  const hasShelf = wasSignedInBeforeTour();
  const [index, setIndex] = useState(readStep);
  const [anchor, setAnchor] = useState<Anchor | null>(null);
  const [lost, setLost] = useState(false);
  const [settled, setSettled] = useState(false);
  const [stuckAside, setStuckAside] = useState(false);
  // where the screen ends for the tour: the top of the phones' bottom bar
  const [floor, setFloor] = useState(() => innerHeight);
  // he's placed from the screen's size, so a rotated phone has to place him again
  const [, onScreenChange] = useReducer((n: number) => n + 1, 0);
  const [bubbleHeight, setBubbleHeight] = useState(180);
  const bubble = useRef<HTMLDivElement>(null);
  const dock = useRef<HTMLButtonElement>(null);
  // the screen layer, whose bottom edge is the screen's for fixed things
  const screen = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const step = TOUR_STEPS[index]!;
  const onPage = isOnStepPage(step, pathname);

  const goTo = useCallback((next: number) => {
    setAnchor(null);
    setLost(false);
    setSettled(false);
    setStuckAside(false);
    setIndex(next);
    try {
      sessionStorage.setItem(STEP_KEY, String(next));
      if (TOUR_STEPS[next]?.allTab)
        sessionStorage.setItem("libraryStatus", "all");
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
        if (step.onTop && Date.now() - startedAt < SETTLED_AFTER_MS) {
          // room above the section for him and his arrow, kept while the page is
          // still filling in above it
          const above =
            (bubble.current?.offsetHeight ?? 160) + BUBBLE_GAP + SCREEN_MARGIN;
          const off = el.getBoundingClientRect().top - above;
          if (Math.abs(off) > 2) window.scrollBy(0, off);
        } else if (
          !step.onTop &&
          scrolled &&
          Date.now() - startedAt < SETTLED_AFTER_MS &&
          el.getBoundingClientRect().top < SCREEN_MARGIN &&
          el.offsetHeight < innerHeight / 2
        ) {
          // the page moved after we scrolled to it, like the shelf putting back
          // where they were: bring a small target back into view
          window.scrollBy(
            0,
            el.getBoundingClientRect().top - SCREEN_MARGIN * 4,
          );
        } else if (!scrolled && !step.onTop) {
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
        // the ring is the target's own box. Only its sides are kept on screen,
        // for a tab that touches the edges. On the page it's kept in page
        // coordinates, which scrolling doesn't change, so nothing redraws mid-scroll
        const pinned = isPinned(el);
        const dy = pinned ? 0 : window.scrollY;
        const dx = pinned ? 0 : window.scrollX;
        const top = Math.round(r.top - HOLE_PADDING);
        const left = Math.round(Math.max(r.left - HOLE_PADDING, RING_INSET));
        const right = Math.min(r.right + HOLE_PADDING, innerWidth - RING_INSET);
        const screenBottom =
          screen.current?.getBoundingClientRect().bottom ?? innerHeight;
        const next = {
          top: Math.round(top + dy),
          left: Math.round(left + dx),
          width: Math.round(right - left),
          height: Math.round(r.bottom + HOLE_PADDING - top),
          pinned,
          fromBottom:
            pinned && r.top + r.height / 2 > screenBottom / 2
              ? Math.round(screenBottom - r.bottom - HOLE_PADDING)
              : null,
        };
        setAnchor((old) =>
          old &&
          old.pinned === next.pinned &&
          old.fromBottom === next.fromBottom &&
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

  // on phones some targets live in the header menu: open it so he can point inside
  // and close it again when the step ends, by Next, Back or leaving the page
  useEffect(() => {
    if (!step.inMenuOnPhone || !onPage || !hasBottomBar()) return;
    const menuButton = () =>
      document.querySelector<HTMLElement>('[data-tour="menu"]');
    const isOpen = () => Boolean(document.getElementById("settings-menu"));
    const timer = setTimeout(() => {
      if (!isOpen()) menuButton()?.click();
    }, MENU_OPENS_AFTER_MS);
    return () => {
      clearTimeout(timer);
      if (isOpen()) menuButton()?.click();
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
    if (step.tap && step.target && !alreadyOpen)
      findTarget(step.target)?.click();
    goTo(index + 1);
  };

  const isLast = index === TOUR_STEPS.length - 1;
  // drawn on the page: everything placed from the screen gets the scroll added back
  const onPageLayer = Boolean(anchor && !anchor.pinned);
  const offY = onPageLayer ? window.scrollY : 0;
  const offX = onPageLayer ? window.scrollX : 0;
  // the target where it is on screen right now, for working out where he goes
  const box: Box | null = anchor && {
    top: anchor.top - offY,
    left: anchor.left - offX,
    width: anchor.width,
    height: anchor.height,
  };
  const onLayer = <T extends { top: number; left: number }>(b: T): T => ({
    ...b,
    top: b.top + offY,
    left: b.left + offX,
  });
  const showHole = Boolean(box) && !lost && onPage;
  // on the way to the step's page, or that page still arriving: out of sight, so
  // his next line never flashes up in the middle of the page they're leaving
  const waiting =
    Boolean(step.target) && !lost && (onPage ? !anchor : !settled);
  const veiled = step.focus && !wentExploring && !waiting;
  // over or under what he's pointing at, if either has the room. A section too big
  // for that gets him out of the way at the bottom, where it can still be read
  const roomAbove = box ? box.top - BUBBLE_GAP - SCREEN_MARGIN : 0;
  const barSpace = hasBottomBar() ? BOTTOM_BAR : 0;
  const roomBelow = box
    ? innerHeight -
      barSpace -
      (box.top + box.height) -
      BUBBLE_GAP -
      SCREEN_MARGIN
    : 0;
  const fits = Math.max(roomAbove, roomBelow) >= bubbleHeight;
  // too big to sit beside: he moves out of the way and stays there for the step,
  // so scrolling doesn't send him back and forth
  const inCorner = !step.onTop && (stuckAside || (showHole && !fits));
  if (!step.onTop && showHole && !fits && !stuckAside) setStuckAside(true);
  // the page is theirs: Kenji shrinks to a bar at the bottom they tap to carry on
  const docked = (step.free || wentExploring) && !isLast;
  // over or under the hole, whichever side has the room; middle of the screen if
  // there's nothing to point at
  const holeMiddle = box ? box.top + box.height / 2 : 0;
  const below =
    !step.onTop &&
    roomBelow >= bubbleHeight &&
    (roomAbove < bubbleHeight || holeMiddle < innerHeight / 2);
  // too big to sit beside: at the bottom, staying put however far they scroll. The
  // big pages marked onTop have him above the section instead, moving with it
  // room to the right of the section, for the steps that would rather sit there
  const sideRoom = box
    ? // the page's width, without the scrollbar
      document.documentElement.clientWidth -
      (box.left + box.width) -
      BUBBLE_GAP -
      SCREEN_MARGIN
    : 0;
  const beside =
    Boolean(step.besideIfRoom) && showHole && sideRoom >= MIN_SIDE_WIDTH;
  const bubbleTop = bubbleTopFor({
    beside,
    inCorner,
    onTop: Boolean(step.onTop),
    showHole,
    below,
    box,
    bubbleHeight,
    viewHeight: innerHeight,
    barSpace,
    scrolled: window.scrollY > 0,
  });
  // in the corner of a wide screen he stays beside the page's column, not over it
  const bubbleWidth = beside
    ? Math.min(340, sideRoom)
    : Math.min(340, innerWidth - SCREEN_MARGIN * 2);

  // the real measurement lets the bubble sit clear of the hole
  useEffect(() => {
    if (bubble.current) setBubbleHeight(bubble.current.offsetHeight);
  }, [index, lost, docked, bubbleWidth]);

  const holeCenter = box ? box.left + box.width / 2 : innerWidth / 2;
  // a section too big to sit beside: at the bottom, centered under it
  const bubbleLeft = bubbleLeftFor({
    beside,
    showHole,
    box,
    holeCenter,
    bubbleWidth,
    viewWidth: innerWidth,
  });
  const pointerLeft = Math.min(
    Math.max(bubbleLeft + 22, holeCenter),
    bubbleLeft + bubbleWidth - 22,
  );

  // waiting for the page: no veil over a page that's still arriving

  // screen readers and keyboards go to what he's saying, once he can be seen. Not
  // to the bar when they've wandered off: they're busy with the page
  useEffect(() => {
    if (step.free) dock.current?.focus({ preventScroll: true });
    else if (!waiting) bubble.current?.focus({ preventScroll: true });
  }, [index, lost, waiting, step.free]);

  if (docked) {
    // what the bar says: the step's own words on a free step, else a word
    // about where they've wandered off to
    let line = "Exploring? Good, that's the idea.";
    if (step.free) line = step.say;
    else if (step.doneOnLeaving && pathname.startsWith("/details/"))
      line = "It's on your shelf! Have a look around.";
    return createPortal(
      <div className="tour" aria-live="polite">
        <button
          ref={dock}
          type="button"
          className="tour-dock"
          style={{
            bottom: `calc(${barSpace + SCREEN_MARGIN}px + env(safe-area-inset-bottom))`,
          }}
          onClick={
            step.free || step.doneOnLeaving ? () => goTo(index + 1) : backToStep
          }
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

  // the bubble moves with what he points at, unless he's out of the way in a
  // corner or has nothing to point at
  const bubbleOnPage = onPageLayer && showHole && !inCorner;
  // the ring, its arrow and Kenji above it, placed from the screen's bottom edge
  const fromBottom = showHole ? (anchor?.fromBottom ?? null) : null;
  // his words: for someone with a shelf, or on a phone, when the step has
  // its own way of saying it for them
  let say = step.say;
  if (hasShelf && step.signedInSay) say = step.signedInSay;
  else if (hasBottomBar() && step.phoneSay) say = step.phoneSay;

  // placed from the bottom when he's in the corner, or over a ring that is
  // itself placed from the bottom; from the top otherwise
  const overARingFromTheBottom =
    fromBottom != null && !beside && !below && !step.onTop;
  let vertical: { top: number } | { bottom: number } = {
    top: bubbleTop + (bubbleOnPage ? offY : 0),
  };
  if (inCorner) vertical = { bottom: SCREEN_MARGIN + barSpace };
  else if (overARingFromTheBottom)
    vertical = { bottom: fromBottom + box!.height + BUBBLE_GAP };
  const ringStyle =
    fromBottom != null
      ? {
          left: box!.left,
          width: box!.width,
          height: box!.height,
          bottom: fromBottom,
        }
      : box && onLayer(box);
  const pageWidth = document.documentElement.clientWidth;
  const pageHeight = Math.max(
    document.documentElement.scrollHeight,
    innerHeight,
  );

  const hole = showHole && (
    <>
      <div
        className={`tour-ring ${step.tap ? "tour-ring-tap" : ""}`}
        style={ringStyle!}
      />
      {/* in a blurred moment, what's only being explained stays put */}
      {step.focus && !step.tap && (
        <div className="tour-shield" style={ringStyle!} />
      )}
      {(step.onTop || (fits && !inCorner)) && (
        <svg
          className={`tour-pointer ${
            beside ? "tour-pointer-left" : below ? "tour-pointer-below" : ""
          }`}
          style={
            fromBottom != null && !beside && !below
              ? {
                  left: pointerLeft - 16,
                  bottom: fromBottom + box!.height + 2,
                }
              : onLayer(
                  beside
                    ? { left: box!.left + box!.width - 2, top: box!.top + 30 }
                    : {
                        left: pointerLeft - 16,
                        top: below ? box!.top + box!.height + 2 : box!.top - 26,
                      },
                )
          }
          viewBox="0 0 32 24"
          aria-hidden
        >
          <path d="M4 3h24L16 21Z" />
        </svg>
      )}
    </>
  );

  const kenji = (
    <div
      ref={bubble}
      role="dialog"
      aria-label="Kenji's tour"
      data-target={step.target}
      tabIndex={-1}
      className={`tour-bubble ${waiting ? "tour-bubble-waiting" : ""}`}
      key={index}
      style={{
        ...vertical,
        left: bubbleLeft + (bubbleOnPage ? offX : 0),
        width: bubbleWidth,
      }}
    >
      <div className="tour-who printed" aria-hidden>
        <Mascot mood="happy" />
      </div>
      <div className="tour-words">
        <p className="tour-count">
          {step.part}
          {step.partSize > 1 && ` · ${step.partStep} of ${step.partSize}`}
        </p>
        <p className="tour-say">{say}</p>
        <div className="tour-actions">
          {isLast ? (
            <>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => endDemo(hasShelf ? "/shelf" : "/signup")}
              >
                {hasShelf ? "Back to my shelf" : "Start your shelf"}
              </button>
              <button
                type="button"
                className="tour-skip"
                onClick={() => endDemo()}
              >
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
                    goTo(
                      TOUR_STEPS[index - 1]!.needsLastStep
                        ? index - 2
                        : index - 1,
                    )
                  }
                >
                  Back
                </button>
              )}
              <button
                type="button"
                className="tour-skip"
                onClick={() => endDemo()}
              >
                Skip tour
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );

  // inside the app's own layer (#root makes one), just above the page and under
  // its sticky toolbar, floating buttons and bottom bar, so those still cover it
  // the way they cover what it points at. Kenji stays above everything
  const app = document.getElementById("root") ?? document.body;
  return (
    <>
      {onPageLayer &&
        createPortal(
          <div
            className="tour-page tour-page-under"
            style={{ width: pageWidth, height: pageHeight }}
          >
            {veiled && (
              <div
                className="tour-veil"
                style={
                  showHole
                    ? {
                        clipPath: holePath(
                          onLayer(box!),
                          pageWidth,
                          pageHeight,
                        ),
                      }
                    : undefined
                }
              />
            )}
            {hole}
          </div>,
          app,
        )}
      {createPortal(
        <>
          {/* on the page too, so he moves with what he points at */}
          {bubbleOnPage && (
            <div
              className="tour-page"
              style={{ width: pageWidth, height: pageHeight }}
            >
              {kenji}
            </div>
          )}
          {/* on the screen: pinned targets, and Kenji when he's out of the way */}
          <div ref={screen} className="tour" aria-live="polite">
            {!onPageLayer && veiled && (
              <div
                className="tour-veil"
                style={
                  showHole
                    ? { clipPath: holePath(visibleBox(box!, floor)) }
                    : undefined
                }
              />
            )}
            {!onPageLayer && showHole && (
              <div
                className="tour-stage"
                style={{ clipPath: `inset(0 0 ${innerHeight - floor}px 0)` }}
              >
                {hole}
              </div>
            )}
            {!bubbleOnPage && kenji}
          </div>
        </>,
        document.body,
      )}
    </>
  );
}
