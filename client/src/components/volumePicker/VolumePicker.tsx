// Which volumes they own, on the add and edit forms: a little bookcase. Each
// volume is a spine on a shelf; theirs stand up inked, the rest lean pale.
// Tap a spine to stand it up or lay it down. Drag across spines to do a run
// at once ("up to 14" is a drag from 1 to 14): starting on one that's down
// stands them up, on one that's up lays them down. Shift-click fills
// everything between the last spine and this one. "Up to vol." types a run.
// Shelves wrap rather than scroll sideways, so on a phone a sideways drag
// paints and an up-and-down swipe still scrolls the page. Phones get
// smaller spines, ten to a row.
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

export function useVolumePicker(
  start: Start,
  // how many volumes are out, as far as the price list knows: the count
  // says "of 113". Not a limit: the list can lag behind what's out
  out?: number | null,
): {
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
  // what they owned when they started typing: each keystroke works from it,
  // so clearing the box to type a new number never loses anything
  const typingFrom = useRef<number[] | null>(null);

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
  // a folded box set is locked until it's opened: a drag or shift-click
  // across it leaves its volumes alone, so "all yours" stays true
  const inBox = (v: number) =>
    folds.some(([first, last]) => v > first * MORE && v <= (last + 1) * MORE);
  const paintTo = (to: number) => {
    const drag = painting.current;
    if (!drag) return;
    const next = new Set(drag.before);
    for (const v of between(drag.from, to).filter((x) => !inBox(x))) {
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
    typingFrom.current = null;
  };
  const spineAt = (x: number, y: number) => {
    const el = document
      .elementFromPoint(x, y)
      ?.closest<HTMLElement>("[data-vol]");
    return el ? Number(el.dataset.vol) : null;
  };
  // mid-drag, a box set counts as its edge nearest where the drag began, so
  // a drag onto it still reaches every spine up to it (and never into it)
  const edgeAt = (x: number, y: number, from: number) => {
    const box = document
      .elementFromPoint(x, y)
      ?.closest<HTMLElement>("[data-box-from]");
    if (!box) return null;
    const first = Number(box.dataset.boxFrom);
    const last = Number(box.dataset.boxTo);
    return from > last ? last : first;
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
      change(
        between(anchor.current, v).filter((x) => !inBox(x)),
        true,
      );
      anchor.current = v;
      setUpToText(null);
      typingFrom.current = null;
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
    const v =
      spineAt(e.clientX, e.clientY) ??
      edgeAt(e.clientX, e.clientY, painting.current.from);
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
      typingFrom.current = null;
    }
    stopPainting();
  };

  // typed: 1 to N stand up, and every volume they owned above N stays (own
  // 1-5 and 8, type 6: 1-6 and 8, never losing the 8). Fewer is done by
  // laying spines down. An empty box changes nothing. The shelves fit the
  // number, growing or shrinking back (50 then 30 leaves four, not six)
  const typeUpTo = (text: string) => {
    typingFrom.current ??= owned;
    const before = typingFrom.current;
    setUpToText(text);
    if (!text.trim()) {
      setOwned(before);
      setFolds(fullRuns(before));
      return;
    }
    const n = Math.min(999, Math.floor(Number(text)));
    if (!(n >= 1)) return;
    const list = [
      ...new Set([
        ...ownedOf({ volumesOwned: n }),
        ...before.filter((v) => v > n),
      ]),
    ].sort((a, b) => a - b);
    setOwned(list);
    setFolds(fullRuns(list));
    setShown(Math.max(FIRST_SHOWN, roundUp(Math.max(n, ...list) + 1)));
  };

  const known = out && out > 0 ? Math.max(out, Math.ceil(top)) : null;
  // a short series shows just what's out, until they ask for more
  const [grown, setGrown] = useState(false);
  const spines = Array.from(
    {
      length: Math.max(
        known && !grown ? Math.min(shown, known) : shown,
        Math.ceil(top),
      ),
    },
    (_, i) => i + 1,
  );
  // whole volumes only, as the "of 113" counts them (10.5 and vol. 0 aren't)
  const ownedWhole = owned.filter((v) => Number.isInteger(v) && v >= 1).length;
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
          Your shelf{" "}
          {/* phones: the room goes to "Up to vol.", on the same line */}
          <span className={`${formStyles.optional} upto-480:hidden`}>
            (optional)
          </span>
        </span>
        <label className={styles.upTo}>
          Up to vol.
          <input
            className={styles.upToInput}
            inputMode="numeric"
            type="number"
            min="1"
            max="999"
            placeholder="e.g. 12"
            value={upToText ?? (run ? String(run) : "")}
            onChange={(e) => typeUpTo(e.target.value)}
            onBlur={() => {
              setUpToText(null);
              typingFrom.current = null;
            }}
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
                data-box-from={from}
                data-box-to={to}
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
            ? `${ownedWhole}${known ? ` of ${known}` : ""} on your shelf · vol. ${rangesText(owned)}`
            : known
              ? `None yet · ${known} volumes out`
              : "None yet"}
        </p>
        <span className={styles.footActions}>
          <button
            type="button"
            className={styles.clear}
            onClick={() => {
              setGrown(true);
              setShown((n) => Math.max(n, spines.length) + MORE);
            }}
          >
            {/* every volume known to be out is already showing: these are
                spines past it, not ones that exist for sure */}
            {known && spines.length >= known
              ? `Show ${MORE} past vol. ${spines.length}`
              : `Show ${MORE} more`}
          </button>
          {owned.length > 0 && (
            <button
              type="button"
              className={styles.clear}
              onClick={() => {
                setOwned([]);
                setFolds([]);
                setUpToText(null);
                typingFrom.current = null;
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
    setFolds(fullRuns(list));
    setUpToText(null);
    typingFrom.current = null;
    anchor.current = null;
    setShown(Math.max(FIRST_SHOWN, roundUp((list[list.length - 1] ?? 0) + 1)));
  };

  return { field, reset };
}
