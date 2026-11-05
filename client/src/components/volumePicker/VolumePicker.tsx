// Which volumes they own, on the add and edit forms: a little bookcase. Each
// volume is a spine on a shelf; theirs stand up inked, the rest lean pale.
// Tap a spine to stand it up or lay it down. Drag across spines to do a run
// at once ("up to 14" is a drag from 1 to 14): starting on one that's down
// stands them up, on one that's up lays them down. Shift-click fills
// everything between the last spine and this one. "Up to vol." types a run.
// Shelves wrap rather than scroll sideways, so on a phone a sideways drag
// paints and an up-and-down swipe still scrolls the page.
// The form reads `volumesOwned` and `ownedList` (comma separated) from its
// fields, as it reads everything else.
import {
  useId,
  useRef,
  useState,
  type PointerEvent,
  type ReactNode,
} from "react";
import { ownedOf, ownedVolumes, rangesText } from "../../lib/ownedVolumes";
import { formStyles } from "../../styles/form";
import { volumePickerStyles as styles } from "./styles";

// spines to start with, and how many more each tap adds: whole shelves
const FIRST_SHOWN = 20;
const MORE = 10;
const roundUp = (n: number) => Math.ceil(n / MORE) * MORE;
const sorted = (set: Set<number>) => [...set].sort((a, b) => a - b);

type Start = { volumesOwned: number | null; ownedList?: number[] };

export function useVolumePicker(start: Start): {
  field: ReactNode;
  // the edit form's manga arrives after the page: start from it
  reset: (to: Start) => void;
} {
  const [owned, setOwned] = useState<number[]>(() => ownedOf(start));
  const top = owned[owned.length - 1] ?? 0;
  const [shown, setShown] = useState(() =>
    Math.max(FIRST_SHOWN, roundUp(top + 1)),
  );
  const labelId = useId();
  // a drag in progress, like selecting text: from the spine it started on
  // to the one under the pointer, standing them up or laying them down.
  // Dragging back gives the spines it leaves back what they were before
  const painting = useRef<null | {
    from: number;
    up: boolean;
    before: number[];
  }>(null);
  // the last spine touched, for shift-click
  const anchor = useRef<number | null>(null);
  // a finger that's just landed: a tap, a sideways drag, or the page
  // scrolling, which the first move tells apart
  const landed = useRef<{ v: number; x: number; y: number } | null>(null);

  const saved = ownedVolumes(null, owned);
  // a run from 1 shows as its number; with gaps the box waits to be typed in
  const run = !saved.ownedList.length ? saved.volumesOwned : null;
  const [upToText, setUpToText] = useState<string | null>(null);

  const change = (vols: number[], up: boolean) =>
    setOwned((list) => {
      const next = new Set(list);
      for (const v of vols) {
        if (up) next.add(v);
        else next.delete(v);
      }
      return sorted(next);
    });
  const between = (a: number, b: number) =>
    Array.from({ length: Math.abs(b - a) + 1 }, (_, i) => Math.min(a, b) + i);
  // the drag, now over spine `to`: the range set, everything else as it was
  const paintTo = (to: number) => {
    const drag = painting.current;
    if (!drag) return;
    const next = new Set(drag.before);
    for (const v of between(drag.from, to)) {
      if (drag.up) next.add(v);
      else next.delete(v);
    }
    setOwned(sorted(next));
  };
  const startPainting = (v: number) => {
    painting.current = { from: v, up: !owned.includes(v), before: owned };
    paintTo(v);
    anchor.current = v;
    setUpToText(null);
  };
  const spineAt = (x: number, y: number) => {
    const el = document
      .elementFromPoint(x, y)
      ?.closest<HTMLElement>("[data-vol]");
    return el ? Number(el.dataset.vol) : null;
  };

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    const v = spineAt(e.clientX, e.clientY);
    if (v == null || e.button !== 0) return;
    if (e.pointerType === "touch") {
      landed.current = { v, x: e.clientX, y: e.clientY };
      return;
    }
    e.preventDefault();
    if (e.shiftKey && anchor.current != null) {
      change(between(anchor.current, v), true);
      anchor.current = v;
      setUpToText(null);
    } else {
      startPainting(v);
      e.currentTarget.setPointerCapture(e.pointerId);
    }
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
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
    const v = spineAt(e.clientX, e.clientY);
    if (v != null) paintTo(v);
  };
  const stopPainting = () => {
    painting.current = null;
    landed.current = null;
  };
  // a finger that lifted without moving: a tap
  const onPointerUp = () => {
    const tap = landed.current;
    if (tap) {
      change([tap.v], !owned.includes(tap.v));
      anchor.current = tap.v;
      setUpToText(null);
    }
    stopPainting();
  };

  // typed: the shelves fit the number, growing or shrinking back (50 then
  // 30 leaves four shelves, not six)
  const typeUpTo = (text: string) => {
    setUpToText(text);
    if (!text.trim()) {
      setOwned([]);
      setShown(FIRST_SHOWN);
      return;
    }
    const n = Math.min(999, Math.floor(Number(text)));
    if (!(n >= 1)) return;
    setOwned(ownedOf({ volumesOwned: n }));
    setShown(Math.max(FIRST_SHOWN, roundUp(n + 1)));
  };

  const spines = Array.from(
    { length: Math.max(shown, Math.ceil(top)) },
    (_, i) => i + 1,
  );
  // ones like 10.5, which have no spine of their own
  const offShelf = owned.filter(
    (v) => !Number.isInteger(v) || v > spines.length,
  );

  const field = (
    <div className={styles.field}>
      <div className={styles.head}>
        <span className={formStyles.label} id={labelId}>
          Your shelf <span className={formStyles.optional}>(optional)</span>
        </span>
        <label className={styles.upTo}>
          Up to vol.
          <input
            className={styles.upToInput}
            inputMode="numeric"
            type="number"
            min="1"
            max="999"
            placeholder="–"
            value={upToText ?? (run ? String(run) : "")}
            onChange={(e) => typeUpTo(e.target.value)}
            onBlur={() => setUpToText(null)}
          />
        </label>
      </div>
      {/* what the form sends */}
      <input
        type="hidden"
        name="volumesOwned"
        value={saved.volumesOwned ?? ""}
      />
      <input type="hidden" name="ownedList" value={saved.ownedList.join(",")} />
      <div
        className={styles.shelf}
        role="group"
        aria-labelledby={labelId}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={stopPainting}
        // only the shelf's own: a finger is held by the spine it landed on
        // until the shelf takes it, and that spine letting go isn't the end
        onLostPointerCapture={(e) => {
          if (e.target === e.currentTarget) stopPainting();
        }}
      >
        {spines.map((v) => {
          const yours = owned.includes(v);
          return (
            <button
              key={v}
              type="button"
              data-vol={v}
              className={styles.slot}
              aria-pressed={yours}
              aria-label={`Vol. ${v}`}
              // pointers are the shelf's; this is Enter and Space
              onClick={(e) => {
                if (e.detail !== 0) return;
                change([v], !yours);
                anchor.current = v;
              }}
            >
              <span className={yours ? styles.spineUp : styles.spineDown}>
                {yours && <span className={styles.yours}>yours</span>}
                <span className={styles.number}>{v}</span>
              </span>
            </button>
          );
        })}
      </div>
      <div className={styles.foot}>
        <p className={styles.said} aria-live="polite">
          {owned.length
            ? `${owned.length} owned · ${rangesText(owned)}`
            : "Tap a spine, or drag across a run of them"}
        </p>
        <span className={styles.footActions}>
          <button
            type="button"
            className={styles.clear}
            onClick={() => setShown((n) => n + MORE)}
          >
            +{MORE} more
          </button>
          {owned.length > 0 && (
            <button
              type="button"
              className={styles.clear}
              onClick={() => {
                setOwned([]);
                setUpToText(null);
                setShown(FIRST_SHOWN);
              }}
            >
              Clear
            </button>
          )}
        </span>
      </div>
      {offShelf.length > 0 && (
        <p className={styles.note}>Also: vol. {rangesText(offShelf)}</p>
      )}
    </div>
  );

  const reset = (to: Start) => {
    const list = ownedOf(to);
    setOwned(list);
    setUpToText(null);
    anchor.current = null;
    setShown(Math.max(FIRST_SHOWN, roundUp((list[list.length - 1] ?? 0) + 1)));
  };

  return { field, reset };
}
