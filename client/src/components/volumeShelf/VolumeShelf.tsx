// Every volume of a series on one shelf, theirs standing in ink, by the title
// on the details page. Tick a book to own it. A long series' books are too
// thin to read, so they grow under the pointer like a magnifier (lib/volumeShelf):
// a mouse hovers to look and clicks to tick; a finger taps to look, taps the
// big book to tick, and slides to move along. A series short enough to hit
// with a finger ticks with one tap. On a touch screen, a series whose books
// would be thinner than a finger shows a page of full-size books instead,
// starting near the one after the furthest they own, with ‹ › to move along: one tap ticks.
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
  // the series, for screen readers
  name: string;
};

// room for the ‹ › on a paged shelf
const NAV = 36;

export default function VolumeShelf({ total, owned, onToggle, name }: Props) {
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
    if (oneTap) {
      press.current.pick = bookAt(widths, x);
      return;
    }
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
    if (p.slid && !oneTap) look(x);
  };
  const onPointerUp = (e: PointerEvent<HTMLDivElement>) => {
    const p = press.current;
    press.current = null;
    if (!p || p.slid) return;
    const volume = e.pointerType === "mouse" ? bookAt(widths, xOf(e)) : p.pick;
    if (volume != null) tick(volume);
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
    return (
      <div className="vshelf-box" ref={box}>
        <div
          className="vshelf vshelf-paged"
          role="group"
          aria-label={`Your volumes of ${name}, vols. ${from} to ${to} of ${total}`}
        >
          <button
            type="button"
            className="vshelf-nav"
            aria-label="Earlier volumes"
            disabled={from <= 1}
            onClick={() => setPageStart(Math.max(1, from - perPage))}
          >
            <ChevronLeftIcon />
          </button>
          <div className="vshelf-page">
            {page.map((v) => (
              <button
                key={v}
                type="button"
                className="vshelf-book"
                style={{ width: BOOK }}
                aria-pressed={yours.has(v)}
                aria-label={`Vol. ${v}`}
                data-own={yours.has(v) || undefined}
                data-size="wide"
                data-small={v >= 100 || undefined}
                data-pop={popped === v || undefined}
                onClick={() => {
                  // the page stays where it is: ticking the next one they
                  // needed mustn't slide the books out from under the finger
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
            onClick={() => setPageStart(Math.min(lastStart, from + perPage))}
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
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => (press.current = null)}
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
