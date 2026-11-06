// Every volume of a series on one shelf, theirs standing in ink, by the title
// on the details page. Tick a book to own it. A long series' books are too
// thin to read, so they grow under the pointer like a magnifier (lib/volumeShelf):
// a mouse hovers to look and clicks to tick; a finger taps to look, taps the
// big book to tick, and slides to move along. A series short enough to hit
// with a finger ticks with one tap. The shelf never changes size, so nothing
// around it moves. Looks: index.css, "the volume shelf".
import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
} from "react";
import {
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

export default function VolumeShelf({ total, owned, onToggle, name }: Props) {
  const shelf = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  // where the pointer is, in resting books from the left; null is resting
  const [aimed, setAimed] = useState<number | null>(null);
  // the pointer is on it: widths follow at once, rather than easing
  const [live, setLive] = useState(false);
  const [popped, setPopped] = useState<number | null>(null);
  const press = useRef<{ x: number; slid: boolean; pick: number | null }>(null);
  const frame = useRef(0);

  useEffect(() => {
    const el = shelf.current;
    if (!el) return;
    const watch = new ResizeObserver(([entry]) =>
      setWidth(entry!.contentRect.width),
    );
    watch.observe(el);
    return () => watch.disconnect();
  }, []);
  useEffect(() => () => cancelAnimationFrame(frame.current), []);

  const yours = new Set(owned);
  const widths = width ? bookWidths(total, width, aimed) : [];
  const lit = aimed == null ? null : Math.min(total, Math.floor(aimed) + 1);
  const oneTap = width / total >= TAPPABLE;

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
    if (!yours.has(volume)) setPopped(volume);
    onToggle(volume);
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
    } else if ((e.key === "Enter" || e.key === " ") && lit != null) {
      e.preventDefault();
      tick(lit);
    }
  };

  return (
    <div className="vshelf-box">
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
        onBlur={rest}
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
                data-small={w < 17 || undefined}
                data-lit={lit === v || undefined}
                data-pop={popped === v || undefined}
                onAnimationEnd={() => setPopped(null)}
              >
                <i>{v}</i>
              </span>
            );
          })}
        </div>
      </div>
      {/* what the keyboard is on, said out loud */}
      <p className="sr-only" role="status">
        {lit != null &&
          `Vol. ${lit}, ${yours.has(lit) ? "yours" : "not yours yet"}`}
      </p>
    </div>
  );
}
