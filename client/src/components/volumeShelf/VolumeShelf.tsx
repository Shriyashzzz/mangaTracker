// Every volume of a series on one shelf, theirs standing in ink, by the title
// on the details page. Tick a book to own it. A long series' books are too
// thin to read, so they grow under the pointer like a magnifier (lib/volumeShelf):
// a mouse hovers to look and clicks to tick; a finger taps to look, taps the
// big book to tick, and slides to move along. A mouse held down and moved
// owns every book it passes going right, and disowns them going left. A series short enough to hit
// with a finger ticks with one tap. On a touch screen, a series whose books
// would be thinner than a finger shows a page of full-size books instead,
// starting near the one after the furthest they own, with ‹ › to move along:
// one tap ticks. On either of those a sideways slide ticks every book it
// passes, as on the add and edit forms (VolumePicker): starting on one that's
// not theirs ticks, on one that is unticks, and sliding back gives the books
// it leaves what they were. Up and down still scrolls the page.
// The shelf never changes size, so nothing around it moves. Looks: index.css,
// "the volume shelf".
import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
} from "react";
import { ChevronLeftIcon, ChevronRightIcon } from "../icons/Icons";
import {
  BOOK,
  NUMBERED,
  SPACED,
  TAPPABLE,
  aimAt,
  bookAt,
  bookWidths,
} from "../../lib/volumeShelf";

type Props = {
  // how many volumes are out
  total: number;
  owned: number[];
  onToggle: (volume: number) => void;
  // a slide across the books: everything they own now
  onPaint: (owned: number[]) => void;
  // the series, for screen readers
  name: string;
};

// room for the ‹ › on a paged shelf
const NAV = 36;

export default function VolumeShelf({
  total,
  owned,
  onToggle,
  onPaint,
  name,
}: Props) {
  const box = useRef<HTMLDivElement>(null);
  const shelf = useRef<HTMLDivElement>(null);
  // a finger, not a mouse: thin books get a page of full-size ones instead
  const [coarse] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(pointer: coarse)").matches,
  );
  // the first volume on a paged shelf; null until they move it
  const [pageStart, setPageStart] = useState<number | null>(null);
  const [width, setWidth] = useState(0);
  // where the pointer is, in resting books from the left; null is resting
  const [aimed, setAimed] = useState<number | null>(null);
  // the pointer is on it: widths follow at once, rather than easing
  const [live, setLive] = useState(false);
  // just ticked: it stands up (cleared on a timer, so reduced motion,
  // which has no animation to end, doesn't leave it set)
  const [popped, setPopped] = useState<number | null>(null);
  const popTimer = useRef(0);
  // said out loud for the keyboard only; a passing mouse says nothing
  const [said, setSaid] = useState("");
  const press = useRef<{ x: number; slid: boolean; pick: number | null }>(null);
  const frame = useRef(0);
  // a finger that's just landed on a book: a tap, a sideways slide, or the
  // page scrolling, which the first move tells apart
  const landed = useRef<{ v: number; x: number; y: number } | null>(null);
  // a slide in progress: from the book it started on to the one under the
  // pointer, ticking them or unticking them, over what they owned before
  const painting = useRef<null | {
    from: number;
    up: boolean;
    before: number[];
    to: number;
    // a mouse: which way it slides decides, not the book it started on
    byDirection?: boolean;
  }>(null);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const watch = new ResizeObserver(([entry]) =>
      setWidth(entry!.contentRect.width),
    );
    watch.observe(el);
    return () => watch.disconnect();
  }, []);
  useEffect(
    () => () => {
      cancelAnimationFrame(frame.current);
      clearTimeout(popTimer.current);
    },
    [],
  );

  const yours = new Set(owned);
  const widths = width ? bookWidths(total, width, aimed) : [];
  const lit = aimed == null ? null : Math.min(total, Math.floor(aimed) + 1);
  const oneTap = width / total >= TAPPABLE;
  const paged = coarse && width > 0 && !oneTap;

  const xOf = (e: PointerEvent) =>
    e.clientX - (shelf.current?.getBoundingClientRect().left ?? 0);
  // one layout a frame, however fast the pointer moves
  const look = (x: number) => {
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      setLive(true);
      setAimed(aimAt(x, total, width));
    });
  };
  const rest = () => {
    cancelAnimationFrame(frame.current);
    setLive(false);
    setAimed(null);
  };
  const tick = (volume: number) => {
    if (!yours.has(volume)) {
      setPopped(volume);
      clearTimeout(popTimer.current);
      popTimer.current = window.setTimeout(() => setPopped(null), 400);
    }
    onToggle(volume);
  };
  const say = (volume: number, theirs: boolean) =>
    setSaid(`Vol. ${volume}, ${theirs ? "yours" : "not yours yet"}`);

  // sliding to tick, as VolumePicker does: the books carry data-vol
  const volumeAt = (x: number, y: number) => {
    const el = document
      .elementFromPoint(x, y)
      ?.closest<HTMLElement>("[data-vol]");
    return el ? Number(el.dataset.vol) : null;
  };
  const paintTo = (to: number) => {
    const slide = painting.current;
    if (!slide || slide.to === to) return;
    slide.to = to;
    const next = new Set(slide.before);
    // a mouse sliding on (to the right) owns what it passes, sliding back
    // disowns it; back on the book it started on, that one is as the click
    // left it
    const up =
      slide.byDirection && to !== slide.from ? to > slide.from : slide.up;
    for (let v = Math.min(slide.from, to); v <= Math.max(slide.from, to); v++) {
      if (up) next.add(v);
      else next.delete(v);
    }
    onPaint([...next].sort((a, b) => a - b));
  };
  const startPainting = (v: number, byDirection = false) => {
    painting.current = {
      from: v,
      up: !yours.has(v),
      before: owned,
      to: v,
      byDirection,
    };
    onPaint(
      yours.has(v)
        ? owned.filter((x) => x !== v)
        : [...owned, v].sort((a, b) => a - b),
    );
  };
  const stopPainting = () => {
    painting.current = null;
    landed.current = null;
  };
  const onPaintDown = (e: PointerEvent<HTMLDivElement>) => {
    const v = volumeAt(e.clientX, e.clientY);
    if (v == null || e.button !== 0) return;
    if (e.pointerType === "touch") {
      landed.current = { v, x: e.clientX, y: e.clientY };
      return;
    }
    e.preventDefault();
    startPainting(v);
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPaintMove = (e: PointerEvent<HTMLDivElement>) => {
    const start = landed.current;
    if (start) {
      const dx = Math.abs(e.clientX - start.x);
      const dy = Math.abs(e.clientY - start.y);
      if (dx < 6 && dy < 6) return;
      landed.current = null;
      // up and down is the page scrolling (it takes the pointer itself)
      if (dy >= dx) return;
      startPainting(start.v);
      e.currentTarget.setPointerCapture(e.pointerId);
    }
    if (!painting.current) return;
    const v = volumeAt(e.clientX, e.clientY);
    if (v != null) paintTo(v);
  };
  // a finger that lifted without moving: a tap
  const onPaintUp = () => {
    const tap = landed.current;
    if (tap) tick(tap.v);
    stopPainting();
  };
  // only the shelf's own: a finger is held by the book it landed on until
  // the shelf takes it, and that book letting go isn't the end
  const onPaintLost = (e: PointerEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) stopPainting();
  };

  // a tap anywhere else puts the magnifier away
  useEffect(() => {
    if (aimed == null) return;
    const away = (e: globalThis.PointerEvent) => {
      if (!shelf.current?.contains(e.target as Node)) rest();
    };
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, [aimed]);

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    const x = xOf(e);
    press.current = { x, slid: false, pick: null };
    if (e.pointerType === "mouse") return;
    e.currentTarget.setPointerCapture(e.pointerId);
    // a book already big enough to see is ticked; anywhere else, look there
    const under = aimed == null ? null : bookAt(widths, x);
    if (under != null && widths[under - 1]! >= NUMBERED)
      press.current.pick = under;
    else look(x);
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const x = xOf(e);
    if (e.pointerType === "mouse") {
      look(x);
      return;
    }
    const p = press.current;
    if (!p) return;
    if (Math.abs(x - p.x) > 8) {
      p.slid = true;
      p.pick = null;
    }
    if (p.slid) look(x);
  };
  const onPointerUp = (e: PointerEvent<HTMLDivElement>) => {
    const p = press.current;
    press.current = null;
    if (!p || p.slid) return;
    const volume = e.pointerType === "mouse" ? bookAt(widths, xOf(e)) : p.pick;
    if (volume != null) tick(volume);
  };

  // a mouse: hovering looks (the magnifier), a click ticks the book under
  // it, and holding the button down while moving owns every book it passes
  // going on (right) and disowns every one going back (left). Off the top or bottom of the shelf the
  // slide carries on by where the pointer is along it
  const mouseVolume = (e: PointerEvent) =>
    volumeAt(e.clientX, e.clientY) ?? bookAt(widths, xOf(e));
  const onMouseDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const v = mouseVolume(e);
    if (v == null) return;
    // no text selected, no drag started, as the slide goes
    e.preventDefault();
    if (!yours.has(v)) {
      setPopped(v);
      clearTimeout(popTimer.current);
      popTimer.current = window.setTimeout(() => setPopped(null), 400);
    }
    startPainting(v, true);
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onMouseMove = (e: PointerEvent<HTMLDivElement>) => {
    look(xOf(e));
    if (!painting.current) return;
    const v = mouseVolume(e);
    if (v != null) paintTo(v);
  };

  // arrows walk the shelf, Enter or Space ticks
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      e.preventDefault();
      const next = Math.min(
        total,
        Math.max(1, (lit ?? 0) + (e.key === "ArrowRight" ? 1 : -1)),
      );
      setLive(false);
      setAimed(next - 0.5);
      say(next, yours.has(next));
    } else if ((e.key === "Enter" || e.key === " ") && lit != null) {
      e.preventDefault();
      tick(lit);
      say(lit, !yours.has(lit));
    }
  };

  if (paged) {
    const perPage = Math.max(5, Math.floor((width - 2 * NAV) / BOOK));
    const lastStart = Math.max(1, total - perPage + 1);
    // near the one after the furthest they own (what Buy it calls next),
    // with a couple before it
    const nextUp = Math.floor(Math.max(0, ...owned)) + 1;
    const from = Math.min(
      lastStart,
      Math.max(1, pageStart ?? Math.min(nextUp, total) - 2),
    );
    const to = Math.min(total, from + perPage - 1);
    const page = Array.from({ length: to - from + 1 }, (_, i) => from + i);
    const turn = (later: boolean) =>
      setPageStart(
        later
          ? Math.min(lastStart, from + perPage)
          : Math.max(1, from - perPage),
      );
    return (
      <div className="vshelf-box" ref={box}>
        <div
          className="vshelf vshelf-paged"
          role="group"
          aria-label={`Your volumes of ${name}, vols. ${from} to ${to} of ${total}`}
          onPointerDown={(e) => {
            // the page stays where it is: ticking the next one they needed
            // mustn't slide the books out from under the finger
            setPageStart(from);
            onPaintDown(e);
          }}
          onPointerMove={onPaintMove}
          onPointerUp={onPaintUp}
          onPointerCancel={stopPainting}
          onLostPointerCapture={onPaintLost}
        >
          <button
            type="button"
            className="vshelf-nav"
            aria-label="Earlier volumes"
            disabled={from <= 1}
            onClick={() => turn(false)}
          >
            <ChevronLeftIcon />
          </button>
          <div className="vshelf-page">
            {page.map((v) => (
              <button
                key={v}
                type="button"
                data-vol={v}
                className="vshelf-book"
                style={{ width: BOOK }}
                aria-pressed={yours.has(v)}
                aria-label={`Vol. ${v}`}
                data-own={yours.has(v) || undefined}
                data-size="wide"
                data-small={v >= 100 || undefined}
                data-pop={popped === v || undefined}
                // pointers are the shelf's; this is Enter and Space
                onClick={(e) => {
                  if (e.detail !== 0) return;
                  setPageStart(from);
                  tick(v);
                  say(v, !yours.has(v));
                }}
              >
                <i aria-hidden>{v}</i>
              </button>
            ))}
          </div>
          <button
            type="button"
            className="vshelf-nav"
            aria-label="Later volumes"
            disabled={to >= total}
            onClick={() => turn(true)}
          >
            <ChevronRightIcon />
          </button>
        </div>
        <p className="sr-only" role="status">
          {said}
        </p>
      </div>
    );
  }

  return (
    <div className="vshelf-box" ref={box}>
      <div
        ref={shelf}
        className="vshelf"
        data-live={live || undefined}
        role="group"
        tabIndex={0}
        aria-label={`Your volumes of ${name}. Arrow keys move along, Enter marks one yours`}
        // a mouse clicks or slides to tick, with the magnifier following
        // it; a short series under a finger slides to tick; a long one
        // under a finger gets the magnifier
        onPointerDown={(e) => {
          if (e.pointerType === "mouse") onMouseDown(e);
          else if (oneTap) onPaintDown(e);
          else onPointerDown(e);
        }}
        onPointerMove={(e) => {
          if (e.pointerType === "mouse") onMouseMove(e);
          else if (oneTap) onPaintMove(e);
          else onPointerMove(e);
        }}
        onPointerUp={(e) => {
          if (e.pointerType === "mouse") stopPainting();
          else if (oneTap) onPaintUp();
          else onPointerUp(e);
        }}
        onPointerCancel={() => {
          press.current = null;
          stopPainting();
        }}
        onLostPointerCapture={onPaintLost}
        onPointerLeave={(e) => {
          if (e.pointerType === "mouse") rest();
        }}
        onKeyDown={onKeyDown}
        onBlur={() => {
          rest();
          setSaid("");
        }}
      >
        <div className="vshelf-row">
          {widths.map((w, i) => {
            const v = i + 1;
            return (
              <span
                key={v}
                data-vol={v}
                className="vshelf-book"
                style={{ width: w }}
                data-own={yours.has(v) || undefined}
                data-size={
                  w >= NUMBERED ? "wide" : w >= SPACED ? "mid" : undefined
                }
                data-small={w < 18 || undefined}
                data-lit={lit === v || undefined}
                data-pop={popped === v || undefined}
              >
                {/* the group's label and the status line say the volume;
                    the drawn numbers would read out 1 to 113 */}
                <i aria-hidden>{v}</i>
              </span>
            );
          })}
        </div>
      </div>
      {/* what the keyboard is on, said out loud */}
      <p className="sr-only" role="status">
        {said}
      </p>
    </div>
  );
}
