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
import Spine from "./Spine";

// spines to start with, and how many more each tap adds: whole shelves
const FIRST_SHOWN = 20;
const MORE = 10;
const roundUp = (n: number) => Math.ceil(n / MORE) * MORE;
const sorted = (set: Set<number>) => [...set].sort((a, b) => a - b);

type Start = { volumesOwned: number | null; ownedList?: number[] };

// whole shelves of ten they own, two or more in a row, as [first, last]
// shelf: a long run (One Piece 1 to 100) folds into one box set, so the
// shelves that still matter aren't eleven rows down
type Run = [number, number];
function fullRuns(list: number[]): Run[] {
  const set = new Set(list);
  const full = (shelf: number) =>
    Array.from({ length: MORE }, (_, i) => shelf * MORE + i + 1).every((v) =>
      set.has(v),
    );
  const last = list.length ? Math.floor(list[list.length - 1]! / MORE) : -1;
  const runs: Run[] = [];
  for (let shelf = 0; shelf <= last; shelf++) {
    if (!full(shelf)) continue;
    let end = shelf;
    while (end + 1 <= last && full(end + 1)) end++;
    if (end > shelf) runs.push([shelf, end]);
    shelf = end;
  }
  return runs;
}

export function useVolumePicker(start: Start): {
  field: ReactNode;
  // the edit form's manga arrives after the page: start from it
  reset: (to: Start) => void;
} {
  const [owned, setOwned] = useState<number[]>(() => ownedOf(start));
  // box sets: what was already theirs, or typed as "up to". Never mid-drag, so
  // nothing folds away from under a finger
  const [folds, setFolds] = useState<Run[]>(() => fullRuns(ownedOf(start)));
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
      setFolds([]);
      setShown(FIRST_SHOWN);
      return;
    }
    const n = Math.min(999, Math.floor(Number(text)));
    if (!(n >= 1)) return;
    const list = ownedOf({ volumesOwned: n });
    setOwned(list);
    setFolds(fullRuns(list));
    setShown(Math.max(FIRST_SHOWN, roundUp(n + 1)));
  };

  const spines = Array.from(
    { length: Math.max(shown, Math.ceil(top)) },
    (_, i) => i + 1,
  );
  // Enter or Space on a spine (pointers are the shelf's)
  const keyToggle = (v: number, yours: boolean) => {
    change([v], !yours);
    anchor.current = v;
  };
  const shelves = Array.from(
    { length: Math.ceil(spines.length / MORE) },
    (_, i) => i,
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
        {shelves.map((shelf) => {
          const run = folds.find(([first]) => first === shelf);
          if (run) {
            const [first, last] = run;
            const from = first * MORE + 1;
            const to = (last + 1) * MORE;
            return (
              <button
                key={`box-${first}`}
                type="button"
                className={styles.box}
                aria-label={`Vols. ${from} to ${to}, all yours. Open to change`}
                onClick={() => setFolds((all) => all.filter((r) => r !== run))}
              >
                <span className={styles.boxSet}>
                  <span className={styles.boxTitle}>
                    Vols. {from}–{to}
                  </span>
                  <span className={styles.boxNote}>all yours · open</span>
                </span>
              </button>
            );
          }
          // inside a box set: drawn by its first shelf
          if (folds.some(([first, last]) => shelf > first && shelf <= last))
            return null;
          return spines
            .slice(shelf * MORE, (shelf + 1) * MORE)
            .map((v) => (
              <Spine
                key={v}
                volume={v}
                yours={owned.includes(v)}
                onKeyboard={keyToggle}
              />
            ));
        })}
      </div>
      <div className={styles.foot}>
        <p className={styles.said} aria-live="polite">
          {owned.length
            ? `${owned.length} owned · ${rangesText(owned)}`
            : "None picked yet"}
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
                setFolds([]);
                setUpToText(null);
                setShown(FIRST_SHOWN);
              }}
            >
              Clear
            </button>
          )}
        </span>
      </div>
      {/* how, said every time: the gestures aren't otherwise visible */}
      <p className={styles.hint}>
        <span className="upto-520:hidden">
          Tap a spine · drag across a run · shift-click to fill a range
        </span>
        <span className="hidden upto-520:inline">
          Tap a spine, or drag across a run
        </span>
      </p>
      {offShelf.length > 0 && (
        <p className={styles.note}>Also: vol. {rangesText(offShelf)}</p>
      )}
    </div>
  );

  const reset = (to: Start) => {
    const list = ownedOf(to);
    setOwned(list);
    setFolds(fullRuns(list));
    setUpToText(null);
    anchor.current = null;
    setShown(Math.max(FIRST_SHOWN, roundUp((list[list.length - 1] ?? 0) + 1)));
  };

  return { field, reset };
}
