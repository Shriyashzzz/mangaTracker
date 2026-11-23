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
import { tick as tickUnderThumb } from "../../lib/haptics";
import { ChevronLeftIcon, ChevronRightIcon } from "../icons/Icons";
import {
  BOOK,
  pageScale,
  NUMBERED,
  SPACED,
  FINGER_TAPPABLE,
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
  // the volume they're in (or have read up to): drawn in red, the rest as
  // usual. Null when we can't tell
  here?: number | null;
  // ordered and on their way: drawn hatched, said in its name
  ordered?: number[];
  // a paged shelf's first page: near this one, rather than where they are
  // (the Volumes tab opens at their first gap)
  opensAt?: number | null;
  // The shelf seen through an edition (lib/editionShelf.ts): each "volume"
  // here is then a slot, a book of the edition or a volume it has no book
  // for. The shelf works the same; these say how a slot differs
  slots?: {
    // a book at full size: thicker than a single volume
    bookWidth: number;
    // what's lettered on its spine, and its name for hovering and reading out
    spine: (slot: number) => string;
    name: (slot: number) => string;
    // how much of it is theirs when not all, 0 to 1: drawn filled that far
    share: (slot: number) => number;
    // a single volume among an edition's books. Where a run of singles
    // starts after books (or books after singles) there's a gap; within a
    // run there's none
    isSingle: (slot: number) => boolean;
    // the name over a run's first spine: the edition's ("Definitive"), or
    // "Singles". Said again over the first spine of a phone's page
    runName?: (slot: number) => string;
  };
};

// room for the ‹ › on a paged shelf
const NAV = 36;

// the gap where an edition's books give way to single volumes (index.css,
// .vshelf-book[data-apart]): room is kept for it, so no spine gets thinner
const APART = 7;

export default function VolumeShelf({
  total,
  owned,
  onToggle,
  onPaint,
  name,
  here = null,
  ordered = [],
  opensAt: asked = null,
  slots,
}: Props) {
  const onTheWay = new Set(ordered);
  // a tablet's page is drawn bigger (index.css): its books are too
  const FULL = (slots?.bookWidth ?? BOOK) * pageScale();
  const spineOf = (v: number) => slots?.spine(v) ?? String(v);
  const nameOf = (v: number) =>
    `${slots?.name(v) ?? `Vol. ${v}`}${onTheWay.has(v) ? ", ordered" : ""}`;
  // what a slot that differs from a plain volume carries: how far a
  // part-owned book is filled, and whether it starts a run set apart
  const slotMarks = (v: number, theirs: boolean, firstShown = 1) => {
    const share = !theirs && slots ? slots.share(v) : 0;
    const named = v === 1 || v === firstShown || startsRun(v);
    return {
      "data-part": share > 0 || undefined,
      "data-ordered": (!theirs && onTheWay.has(v)) || undefined,
      "data-apart": startsRun(v) || undefined,
      "data-run": (named && slots?.runName?.(v)) || undefined,
      // never so far down that its number sits on ink
      style: share > 0 ? { "--part": `${20 + share * 35}%` } : undefined,
    };
  };
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
    // it has been off the book it started on
    left: boolean;
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
  // the first of a run: a single after a book, or a book after a single
  // (or a book of another edition: a Definitive beside a VIZBIG)
  const startsRun = (v: number) =>
    Boolean(
      slots &&
      v > 1 &&
      (slots.isSingle(v) !== slots.isSingle(v - 1) ||
        (slots.runName?.(v) ?? "") !== (slots.runName?.(v - 1) ?? "")),
    );
  let gaps = 0;
  for (let v = 2; v <= total; v++) if (startsRun(v)) gaps++;
  // the books share what's left once the gaps have their room
  const room = Math.max(0, width - gaps * APART);
  const widths = width ? bookWidths(total, room, aimed, FULL) : [];
  // A shelf with room to spare sits in the middle, its books at full size,
  // the space shared either side. A finger's place is then read from where
  // the row starts, and aimed across the row, not the whole box
  const atRest = width
    ? bookWidths(total, room, null, FULL).reduce((sum, w) => sum + w, 0) +
      gaps * APART
    : 0;
  const offset = width > atRest + 1 ? (width - atRest) / 2 : 0;
  const span = offset ? atRest : width;
  const lit = aimed == null ? null : Math.min(total, Math.floor(aimed) + 1);
  const oneTap = width / total >= (coarse ? FINGER_TAPPABLE : TAPPABLE);
  const paged = coarse && width > 0 && !oneTap;

  const xOf = (e: PointerEvent) =>
    e.clientX - (shelf.current?.getBoundingClientRect().left ?? 0) - offset;
  // one layout a frame, however fast the pointer moves
  const look = (x: number) => {
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      setLive(true);
      setAimed(aimAt(x, total, span, FULL));
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
    tickUnderThumb();
    onToggle(volume);
  };
  const say = (volume: number, theirs: boolean) =>
    setSaid(`${nameOf(volume)}, ${theirs ? "yours" : "not yours yet"}`);

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
    // a tick for each book the slide reaches, as a tap gives one
    tickUnderThumb();
    // back on the book it started on after leaving it: the whole slide taken
    // back, that book too (11 → 13 → 11 leaves 11 as it was, not ticked)
    if (to === slide.from && slide.left) {
      onPaint(slide.before);
      return;
    }
    if (to !== slide.from) slide.left = true;
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
      left: false,
    };
    tickUnderThumb();
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
    // (a page may hold a gap: room for one)
    const pageRoom = width - 2 * NAV * pageScale() - (gaps ? APART : 0);
    const perPage = Math.max(5, Math.floor(pageRoom / FULL));
    const lastStart = Math.max(1, total - perPage + 1);
    // near the volume they're in, when it's marked; else near the one after
    // the furthest they own (what Buy it calls next); a couple before it
    const nextUp = Math.floor(Math.max(0, ...owned)) + 1;
    const opensAt = asked ?? here ?? nextUp;
    const from = Math.min(
      lastStart,
      Math.max(1, pageStart ?? Math.min(opensAt, total) - 2),
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
          data-runs={slots?.runName ? true : undefined}
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
                {...slotMarks(v, yours.has(v), page[0])}
                style={{ width: FULL, ...slotMarks(v, yours.has(v)).style }}
                aria-pressed={yours.has(v)}
                aria-label={nameOf(v)}
                title={slots ? nameOf(v) : undefined}
                data-own={yours.has(v) || undefined}
                data-here={here === v || undefined}
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
                <i aria-hidden>{spineOf(v)}</i>
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
        data-runs={slots?.runName ? true : undefined}
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
        <div className="vshelf-row" style={{ left: offset }}>
          {widths.map((w, i) => {
            const v = i + 1;
            return (
              <span
                key={v}
                data-vol={v}
                className="vshelf-book"
                {...slotMarks(v, yours.has(v))}
                style={{ width: w, ...slotMarks(v, yours.has(v)).style }}
                title={slots ? nameOf(v) : undefined}
                data-own={yours.has(v) || undefined}
                data-here={here === v || undefined}
                data-size={
                  w >= NUMBERED ? "wide" : w >= SPACED ? "mid" : undefined
                }
                data-small={w < 18 || undefined}
                data-lit={lit === v || undefined}
                data-pop={popped === v || undefined}
              >
                {/* the group's label and the status line say the volume;
                    the drawn numbers would read out 1 to 113 */}
                <i aria-hidden>{spineOf(v)}</i>
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
